import { PIP_CONFIG } from "./pip-types";

/** Configuration for the PiP hover-to-expand feature. */
export const PIP_EXPAND = {
  DEFAULT_WIDTH: 800, // Medium / 2x of the resting width
  MIN_WIDTH: 500, // 1.25x
  MAX_WIDTH: 1600, // 4x
  ASPECT: PIP_CONFIG.WIDTH / PIP_CONFIG.HEIGHT, // 400/300 = 4/3
  COLLAPSE_DELAY_MS: 250,
  PRESETS: [
    { label: "Small", width: 600 },
    { label: "Medium", width: 800 },
    { label: "Large", width: 1000 },
  ],
} as const;

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
