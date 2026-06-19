"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import { PIP_CONFIG } from "@/lib/pip-types";
import {
  PIP_HOVER,
  detectPipResizer,
  detectPipCursorProbe,
  expandedSize,
  pipHoverAction,
  type PipWindowResizer,
  type PipCursorProbe,
} from "@/lib/pip-resize";
import { pipDebug } from "@/lib/pip-debug";

export interface UsePipHoverExpandOptions {
  /** Inject a fake resizer in tests; defaults to the detected backend. */
  resizer?: PipWindowResizer;
  /** Inject a fake cursor probe in tests; defaults to the detected backend. */
  cursorProbe?: PipCursorProbe;
}

/**
 * Grows the PiP window with hysteresis. It expands once the cursor reaches the
 * inner core of the collapsed window (a 32px inset). It collapses only once the
 * cursor travels past the expanded window by COLLAPSE_OUTSET px — measured by the
 * Electron main process through `cursorProbe`, since the renderer cannot see the
 * cursor outside its own window. While the cursor sits in that buffer ring the
 * window stays expanded. Polling runs only while the cursor is outside the window
 * (between pointerleave and pointerenter). Reads `pipHoverExpandEnabled` /
 * `pipExpandWidth` from the store.
 */
export function usePipHoverExpand(options: UsePipHoverExpandOptions = {}): void {
  const { resizer: injectedResizer, cursorProbe: injectedProbe } = options;
  const enabled = useAgentStore((s) => s.pipHoverExpandEnabled);
  const width = useAgentStore((s) => s.pipExpandWidth);
  const resizer = useMemo(
    () => injectedResizer ?? detectPipResizer(),
    [injectedResizer],
  );
  const cursorProbe = useMemo(
    () => injectedProbe ?? detectPipCursorProbe(),
    [injectedProbe],
  );
  const isExpanded = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchGen = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const collapsed = { width: PIP_CONFIG.WIDTH, height: PIP_CONFIG.HEIGHT };
    pipDebug(
      `hook effect: enabled=${enabled} width=${width} resizer=${resizer.name} probe=${cursorProbe.name}`,
    );

    const stopWatch = () => {
      if (pollTimer.current !== null) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      watchGen.current++; // invalidate any in-flight isBeyond()
    };

    const collapse = () => {
      stopWatch();
      if (!isExpanded.current) return;
      isExpanded.current = false;
      pipDebug(`collapse → ${PIP_CONFIG.WIDTH}x${PIP_CONFIG.HEIGHT}`);
      resizer.resize(PIP_CONFIG.WIDTH, PIP_CONFIG.HEIGHT);
    };

    if (!enabled) {
      // Feature off: ensure resting size, then attach no listeners.
      collapse();
      return;
    }

    const expand = () => {
      stopWatch();
      if (isExpanded.current) return;
      isExpanded.current = true;
      const size = expandedSize(width);
      pipDebug(`expand → ${size.width}x${size.height}`);
      resizer.resize(size.width, size.height);
    };

    const startWatch = () => {
      if (pollTimer.current !== null) return; // already watching
      const gen = ++watchGen.current;
      pollTimer.current = setInterval(async () => {
        const beyond = await cursorProbe.isBeyond(PIP_HOVER.COLLAPSE_OUTSET);
        if (gen !== watchGen.current || !isExpanded.current) return; // cancelled / superseded
        if (beyond) collapse();
      }, PIP_HOVER.COLLAPSE_POLL_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (isExpanded.current) return; // expanded: collapse is driven by leave/enter
      if (pipHoverAction({ x: e.clientX, y: e.clientY }, false, collapsed) === "expand") {
        expand();
      }
    };

    const onLeave = () => {
      if (isExpanded.current) startWatch(); // crossed the window edge → watch the buffer
    };

    const onEnter = () => {
      stopWatch(); // back over the window → stays expanded
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerenter", onEnter);

    return () => {
      stopWatch();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerenter", onEnter);
    };
  }, [enabled, width, resizer, cursorProbe]);
}
