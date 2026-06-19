import { PIP_CONFIG, getElectronAPI } from "./pip-types";
import type { ElectronPipAPI } from "./pip-types";

/** Configuration for the PiP hover-to-expand feature. */
export const PIP_EXPAND = {
  DEFAULT_WIDTH: 800, // Medium / 2x of the resting width
  MIN_WIDTH: 500, // 1.25x
  MAX_WIDTH: 1600, // 4x
  ASPECT: PIP_CONFIG.WIDTH / PIP_CONFIG.HEIGHT, // 400/300 = 4/3
  PRESETS: [
    { label: "Small", width: 600 },
    { label: "Medium", width: 800 },
    { label: "Large", width: 1000 },
  ],
} as const;

/** Hover-expand hysteresis constant. */
export const PIP_HOVER = {
  /** Pixels the cursor must travel past the collapsed edge before expanding. */
  EXPAND_INSET: 32,
  /** Pixels the cursor must travel past the expanded window before collapsing. */
  COLLAPSE_OUTSET: 40,
  /** Poll cadence (ms) for the cursor-beyond check while the cursor is outside the window. */
  COLLAPSE_POLL_MS: 80,
} as const;

/**
 * Decide the next hover action from the cursor's position within the PiP window.
 *
 * `pointer` is window-relative (top-left origin), or `null` when the cursor has
 * left the window entirely. `collapsed` is the resting window size; while
 * collapsed the window *is* that size, so the center test uses it directly.
 *
 * - collapsed + pointer inside the core (collapsed box inset by `inset`) → "expand"
 * - expanded + pointer gone (null)                                       → "collapse"
 * - everything else                                                      → "none"
 */
export function pipHoverAction(
  pointer: { x: number; y: number } | null,
  expanded: boolean,
  collapsed: { width: number; height: number },
  inset: number = PIP_HOVER.EXPAND_INSET,
): "expand" | "collapse" | "none" {
  if (expanded) return pointer === null ? "collapse" : "none";
  if (pointer === null) return "none";
  const dx = Math.abs(pointer.x - collapsed.width / 2);
  const dy = Math.abs(pointer.y - collapsed.height / 2);
  const ex = collapsed.width / 2 - inset;
  const ey = collapsed.height / 2 - inset;
  return dx <= ex && dy <= ey ? "expand" : "none";
}

/** Clamp an expanded width to the allowed range; NaN falls back to the default. */
export function clampExpandWidth(width: number): number {
  if (Number.isNaN(width)) return PIP_EXPAND.DEFAULT_WIDTH;
  return Math.min(
    PIP_EXPAND.MAX_WIDTH,
    Math.max(PIP_EXPAND.MIN_WIDTH, Math.round(width)),
  );
}

/** Given an expanded width, derive the 4:3 expanded size. */
export function expandedSize(width: number): { width: number; height: number } {
  const w = clampExpandWidth(width);
  return { width: w, height: Math.round(w / PIP_EXPAND.ASPECT) };
}

/** Resizes the live PiP window. One implementation per backend. */
export interface PipWindowResizer {
  readonly name: string;
  resize(width: number, height: number): void;
}

/** Electron: ask the main process (which owns the BrowserWindow) to resize. */
export class ElectronPipWindowResizer implements PipWindowResizer {
  readonly name = "electron";
  resize(width: number, height: number): void {
    getElectronAPI()?.pipResize(width, height);
  }
}

/** Browser: the /pip content is an iframe whose parent IS the Document-PiP window. */
export class BrowserPipWindowResizer implements PipWindowResizer {
  readonly name = "browser";
  constructor(private readonly target: Pick<Window, "resizeTo"> = window.parent) {}
  resize(width: number, height: number): void {
    try {
      this.target.resizeTo(width, height);
    } catch {
      // Some browsers disallow resizeTo on a Document-PiP window; degrade to no-op.
    }
  }
}

export class NullPipWindowResizer implements PipWindowResizer {
  readonly name = "none";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resize(_width: number, _height: number): void {}
}

export interface PipResizerEnv {
  electronApi: ElectronPipAPI | null;
  isIframed: boolean;
}

function defaultPipResizerEnv(): PipResizerEnv {
  return {
    electronApi: getElectronAPI(),
    isIframed: typeof window !== "undefined" && window.parent !== window.self,
  };
}

/** Pick the resizer appropriate to the current runtime. */
export function detectPipResizer(
  env: PipResizerEnv = defaultPipResizerEnv(),
): PipWindowResizer {
  if (env.electronApi) return new ElectronPipWindowResizer();
  if (env.isIframed) return new BrowserPipWindowResizer();
  return new NullPipWindowResizer();
}

/** Queries whether the global cursor is more than `outset` px outside the PiP window. */
export interface PipCursorProbe {
  readonly name: string;
  isBeyond(outset: number): Promise<boolean>;
}

/** Electron: only the main process can read the global cursor + window bounds. */
export class ElectronPipCursorProbe implements PipCursorProbe {
  readonly name = "electron";
  isBeyond(outset: number): Promise<boolean> {
    const api = getElectronAPI();
    return api ? api.pipCursorBeyond(outset) : Promise.resolve(true);
  }
}

/** Non-Electron: no global cursor → any leave collapses (old behavior). */
export class NullPipCursorProbe implements PipCursorProbe {
  readonly name = "none";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isBeyond(_outset: number): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** Pick the cursor probe appropriate to the current runtime. */
export function detectPipCursorProbe(
  env: PipResizerEnv = defaultPipResizerEnv(),
): PipCursorProbe {
  return env.electronApi ? new ElectronPipCursorProbe() : new NullPipCursorProbe();
}
