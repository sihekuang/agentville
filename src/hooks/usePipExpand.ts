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

export interface UsePipExpandOptions {
  /** Inject a fake resizer in tests; defaults to the detected backend. */
  resizer?: PipWindowResizer;
  /** Inject a fake cursor probe in tests; defaults to the detected backend. */
  cursorProbe?: PipCursorProbe;
}

/**
 * Grows the PiP window according to the selected trigger mode
 * (`pipExpandTrigger`: "off" | "hover" | "click"):
 *
 * - "off": never auto-expands; ensures the resting size and attaches no listeners.
 * - "hover": expands once the cursor reaches the inner core of the collapsed
 *   window (a 32px inset) and collapses only once the cursor travels past the
 *   expanded window by COLLAPSE_OUTSET px — measured by the Electron main process
 *   through `cursorProbe`, since the renderer cannot see the cursor outside its
 *   own window. Polling runs only while the cursor is outside the window.
 * - "click": expands on any pointerdown inside the window and collapses when the
 *   window loses focus (the user clicks outside it) via the DOM `window` blur
 *   event — no cursor polling.
 *
 * On teardown (mode switch) an expanded window is collapsed so it is never
 * orphaned at the large size. Reads `pipExpandTrigger` / `pipExpandWidth`.
 */
export function usePipExpand(options: UsePipExpandOptions = {}): void {
  const { resizer: injectedResizer, cursorProbe: injectedProbe } = options;
  const trigger = useAgentStore((s) => s.pipExpandTrigger);
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
      `hook effect: trigger=${trigger} width=${width} resizer=${resizer.name} probe=${cursorProbe.name}`,
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

    const expand = () => {
      stopWatch();
      if (isExpanded.current) return;
      isExpanded.current = true;
      const size = expandedSize(width);
      pipDebug(`expand → ${size.width}x${size.height}`);
      resizer.resize(size.width, size.height);
    };

    if (trigger === "off") {
      // Feature off: ensure resting size, then attach no listeners.
      collapse();
      return;
    }

    if (trigger === "click") {
      const onDown = () => {
        if (!isExpanded.current) expand();
      };
      const onBlur = () => {
        if (isExpanded.current) collapse(); // window lost focus → user clicked outside
      };
      root.addEventListener("pointerdown", onDown);
      window.addEventListener("blur", onBlur);
      return () => {
        root.removeEventListener("pointerdown", onDown);
        window.removeEventListener("blur", onBlur);
        if (isExpanded.current) collapse(); // don't orphan a large window on mode switch
      };
    }

    // trigger === "hover"
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
      if (isExpanded.current) collapse(); // don't orphan a large window on mode switch
    };
  }, [trigger, width, resizer, cursorProbe]);
}
