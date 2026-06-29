"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import {
  PIP_CONFIG,
  PIP_EXPAND_REQUEST_EVENT,
  PIP_SUPPRESS_COLLAPSE_EVENT,
  getElectronAPI,
} from "@/lib/pip-types";
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

/** How long after a session-focus action to ignore the resulting blur. Covers
 * the focus AppleScript latency without swallowing a later genuine click-away. */
const BLUR_SUPPRESS_MS = 1500;

/** Subscribe to "the PiP window lost focus" (a click-away). Prefers the Electron
 * main-process blur — the renderer's DOM `window` blur does NOT fire on macOS
 * app-switch for this floating panel — and falls back to DOM blur off Electron. */
function defaultSubscribeWindowBlur(onBlur: () => void): () => void {
  const api = getElectronAPI();
  if (api?.onPipBlur) return api.onPipBlur(onBlur);
  window.addEventListener("blur", onBlur);
  return () => window.removeEventListener("blur", onBlur);
}

export interface UsePipExpandOptions {
  /** Inject a fake resizer in tests; defaults to the detected backend. */
  resizer?: PipWindowResizer;
  /** Inject a fake cursor probe in tests; defaults to the detected backend. */
  cursorProbe?: PipCursorProbe;
  /** Inject the blur (click-away) subscription in tests; defaults to the
   *  Electron main-process blur with a DOM-blur fallback. */
  subscribeWindowBlur?: (onBlur: () => void) => () => void;
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
  const {
    resizer: injectedResizer,
    cursorProbe: injectedProbe,
    subscribeWindowBlur = defaultSubscribeWindowBlur,
  } = options;
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
  // Timestamp until which a blur-collapse is suppressed (set when the user
  // activates a session from inside the PiP — that focus blurs us, but it is
  // not a click-away). Generous enough to cover the focus AppleScript latency.
  const suppressBlurUntil = useRef(0);

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
      // Expand only when the scene reports an empty-canvas press — NOT on a raw
      // document pointerdown. Clicking an agent (double-click → focus) or a DOM
      // control button must not resize the window mid-gesture, so those never
      // emit PIP_EXPAND_REQUEST_EVENT (see AgentVilleScene's background hit layer).
      const onExpandRequest = () => {
        if (!isExpanded.current) expand();
      };
      const onSuppressCollapse = () => {
        suppressBlurUntil.current = Date.now() + BLUR_SUPPRESS_MS;
      };
      const onBlur = () => {
        if (Date.now() < suppressBlurUntil.current) return; // focusing a session, not a click-away
        if (isExpanded.current) collapse(); // window lost focus → user clicked outside
      };
      window.addEventListener(PIP_EXPAND_REQUEST_EVENT, onExpandRequest);
      window.addEventListener(PIP_SUPPRESS_COLLAPSE_EVENT, onSuppressCollapse);
      const unsubscribeBlur = subscribeWindowBlur(onBlur);
      return () => {
        window.removeEventListener(PIP_EXPAND_REQUEST_EVENT, onExpandRequest);
        window.removeEventListener(PIP_SUPPRESS_COLLAPSE_EVENT, onSuppressCollapse);
        unsubscribeBlur();
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
  }, [trigger, width, resizer, cursorProbe, subscribeWindowBlur]);
}
