"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import { PIP_CONFIG } from "@/lib/pip-types";
import {
  detectPipResizer,
  expandedSize,
  pipHoverAction,
  type PipWindowResizer,
} from "@/lib/pip-resize";
import { pipDebug } from "@/lib/pip-debug";

export interface UsePipHoverExpandOptions {
  /** Inject a fake resizer in tests; defaults to the detected backend. */
  resizer?: PipWindowResizer;
}

/**
 * Grows the PiP window with hysteresis: it expands once the cursor reaches the
 * inner core of the collapsed window (a 32px inset), and collapses only once the
 * cursor leaves the whole expanded window. The separated thresholds make the
 * size sticky, so no collapse-debounce timer is needed. Reads
 * `pipHoverExpandEnabled` / `pipExpandWidth` from the store.
 */
export function usePipHoverExpand(options: UsePipHoverExpandOptions = {}): void {
  const { resizer: injectedResizer } = options;
  const enabled = useAgentStore((s) => s.pipHoverExpandEnabled);
  const width = useAgentStore((s) => s.pipExpandWidth);
  const resizer = useMemo(
    () => injectedResizer ?? detectPipResizer(),
    [injectedResizer],
  );
  const isExpanded = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const collapsed = { width: PIP_CONFIG.WIDTH, height: PIP_CONFIG.HEIGHT };
    pipDebug(`hook effect: enabled=${enabled} width=${width} resizer=${resizer.name}`);

    const collapse = () => {
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
      if (isExpanded.current) return;
      isExpanded.current = true;
      const size = expandedSize(width);
      pipDebug(`expand → ${size.width}x${size.height}`);
      resizer.resize(size.width, size.height);
    };

    const onMove = (e: PointerEvent) => {
      if (pipHoverAction({ x: e.clientX, y: e.clientY }, isExpanded.current, collapsed) === "expand") {
        expand();
      }
    };

    const onLeave = () => {
      if (pipHoverAction(null, isExpanded.current, collapsed) === "collapse") {
        collapse();
      }
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, width, resizer]);
}
