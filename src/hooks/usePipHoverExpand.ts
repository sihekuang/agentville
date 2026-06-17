"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useAgentStore } from "@/store/agents";
import { PIP_CONFIG } from "@/lib/pip-types";
import {
  PIP_EXPAND,
  detectPipResizer,
  expandedSize,
  type PipWindowResizer,
} from "@/lib/pip-resize";
import { pipDebug } from "@/lib/pip-debug";

export interface UsePipHoverExpandOptions {
  /**
   * Element whose hover triggers the expand. Defaults to `document.documentElement`
   * (the whole window). Pass a ref to the canvas region so hovering the PiP's
   * top bar (drag handle / buttons) does NOT trigger a resize.
   */
  targetRef?: RefObject<HTMLElement | null>;
  /** Inject a fake resizer in tests; defaults to the detected backend. */
  resizer?: PipWindowResizer;
}

/**
 * Grows the PiP window while the cursor is over the trigger element and collapses
 * it back when the cursor leaves. Reads `pipHoverExpandEnabled` / `pipExpandWidth`
 * from the store.
 */
export function usePipHoverExpand(options: UsePipHoverExpandOptions = {}): void {
  const { targetRef, resizer: injectedResizer } = options;
  const enabled = useAgentStore((s) => s.pipHoverExpandEnabled);
  const width = useAgentStore((s) => s.pipExpandWidth);
  const resizer = useMemo(
    () => injectedResizer ?? detectPipResizer(),
    [injectedResizer],
  );
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = useRef(false);

  useEffect(() => {
    const root: HTMLElement = targetRef?.current ?? document.documentElement;
    pipDebug(`hook effect: enabled=${enabled} width=${width} resizer=${resizer.name}`);

    const clearTimer = () => {
      if (collapseTimer.current !== null) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
    };

    const collapse = () => {
      if (!isExpanded.current) return;
      isExpanded.current = false;
      pipDebug(`collapse → ${PIP_CONFIG.WIDTH}x${PIP_CONFIG.HEIGHT}`);
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
      pipDebug(`expand → ${size.width}x${size.height}`);
      resizer.resize(size.width, size.height);
    };

    const scheduleCollapse = () => {
      clearTimer();
      pipDebug("leave → collapse scheduled");
      collapseTimer.current = setTimeout(collapse, PIP_EXPAND.COLLAPSE_DELAY_MS);
    };

    root.addEventListener("mouseenter", expand);
    root.addEventListener("mouseleave", scheduleCollapse);

    return () => {
      clearTimer();
      root.removeEventListener("mouseenter", expand);
      root.removeEventListener("mouseleave", scheduleCollapse);
    };
  }, [enabled, width, resizer, targetRef]);
}
