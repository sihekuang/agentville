"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import { PIP_CONFIG } from "@/lib/pip-types";
import {
  PIP_EXPAND,
  detectPipResizer,
  expandedSize,
  type PipWindowResizer,
} from "@/lib/pip-resize";

/**
 * Grows the PiP window while the cursor is over it and collapses it back when the
 * cursor leaves. Reads `pipHoverExpandEnabled` / `pipExpandWidth` from the store.
 * Pass a resizer to inject a fake in tests; defaults to the detected backend.
 */
export function usePipHoverExpand(injectedResizer?: PipWindowResizer): void {
  const enabled = useAgentStore((s) => s.pipHoverExpandEnabled);
  const width = useAgentStore((s) => s.pipExpandWidth);
  const resizer = useMemo(
    () => injectedResizer ?? detectPipResizer(),
    [injectedResizer],
  );
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    const clearTimer = () => {
      if (collapseTimer.current !== null) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
    };

    const collapse = () => {
      if (!isExpanded.current) return;
      isExpanded.current = false;
      resizer.resize(PIP_CONFIG.WIDTH, PIP_CONFIG.HEIGHT);
    };

    if (!enabled) {
      // Feature off: ensure resting size, then attach no listeners.
      clearTimer();
      collapse();
      return;
    }

    const expand = () => {
      clearTimer();
      if (isExpanded.current) return;
      isExpanded.current = true;
      const size = expandedSize(width);
      resizer.resize(size.width, size.height);
    };

    const scheduleCollapse = () => {
      clearTimer();
      collapseTimer.current = setTimeout(collapse, PIP_EXPAND.COLLAPSE_DELAY_MS);
    };

    root.addEventListener("mouseenter", expand);
    root.addEventListener("mouseleave", scheduleCollapse);

    return () => {
      clearTimer();
      root.removeEventListener("mouseenter", expand);
      root.removeEventListener("mouseleave", scheduleCollapse);
    };
  }, [enabled, width, resizer]);
}
