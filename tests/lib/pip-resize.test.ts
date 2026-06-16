import { describe, it, expect } from "vitest";
import {
  PIP_EXPAND,
  clampExpandWidth,
  expandedSize,
} from "@/lib/pip-resize";

describe("PIP_EXPAND", () => {
  it("has a default within the allowed range", () => {
    expect(PIP_EXPAND.DEFAULT_WIDTH).toBeGreaterThanOrEqual(PIP_EXPAND.MIN_WIDTH);
    expect(PIP_EXPAND.DEFAULT_WIDTH).toBeLessThanOrEqual(PIP_EXPAND.MAX_WIDTH);
  });

  it("presets are all within range", () => {
    for (const p of PIP_EXPAND.PRESETS) {
      expect(p.width).toBeGreaterThanOrEqual(PIP_EXPAND.MIN_WIDTH);
      expect(p.width).toBeLessThanOrEqual(PIP_EXPAND.MAX_WIDTH);
    }
  });
});

describe("clampExpandWidth", () => {
  it("returns an in-range value unchanged", () => {
    expect(clampExpandWidth(800)).toBe(800);
  });
  it("clamps below the minimum", () => {
    expect(clampExpandWidth(100)).toBe(PIP_EXPAND.MIN_WIDTH);
  });
  it("clamps above the maximum", () => {
    expect(clampExpandWidth(99999)).toBe(PIP_EXPAND.MAX_WIDTH);
  });
  it("rounds fractional values", () => {
    expect(clampExpandWidth(800.6)).toBe(801);
  });
  it("falls back to default for non-finite input", () => {
    expect(clampExpandWidth(NaN)).toBe(PIP_EXPAND.DEFAULT_WIDTH);
    expect(clampExpandWidth(Infinity)).toBe(PIP_EXPAND.MAX_WIDTH);
  });
});

describe("expandedSize", () => {
  it("derives a 4:3 height from the width", () => {
    expect(expandedSize(800)).toEqual({ width: 800, height: 600 });
    expect(expandedSize(600)).toEqual({ width: 600, height: 450 });
    expect(expandedSize(1000)).toEqual({ width: 1000, height: 750 });
  });
  it("clamps the width before deriving height", () => {
    expect(expandedSize(100)).toEqual({ width: 500, height: 375 });
  });
});
