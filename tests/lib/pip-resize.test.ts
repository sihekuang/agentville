import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  PIP_EXPAND,
  clampExpandWidth,
  expandedSize,
  ElectronPipWindowResizer,
  BrowserPipWindowResizer,
  NullPipWindowResizer,
  detectPipResizer,
} from "@/lib/pip-resize";
import type { ElectronPipAPI } from "@/lib/pip-types";

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

function mockElectronAPI(): ElectronPipAPI {
  return {
    pipActivate: vi.fn(),
    pipDeactivate: vi.fn(),
    pipFocusMain: vi.fn(),
    pipResize: vi.fn(),
    onPipActivated: vi.fn(() => () => {}),
    onPipDeactivated: vi.fn(() => () => {}),
  };
}

describe("ElectronPipWindowResizer", () => {
  afterEach(() => {
    delete (window as any).electronAPI;
  });
  it("calls electronAPI.pipResize", () => {
    const api = mockElectronAPI();
    (window as any).electronAPI = api;
    new ElectronPipWindowResizer().resize(800, 600);
    expect(api.pipResize).toHaveBeenCalledWith(800, 600);
  });
});

describe("BrowserPipWindowResizer", () => {
  it("calls resizeTo on the injected target", () => {
    const target = { resizeTo: vi.fn() };
    new BrowserPipWindowResizer(target).resize(800, 600);
    expect(target.resizeTo).toHaveBeenCalledWith(800, 600);
  });
  it("swallows errors from resizeTo (degrades to no-op)", () => {
    const target = { resizeTo: vi.fn(() => { throw new Error("blocked"); }) };
    expect(() => new BrowserPipWindowResizer(target).resize(800, 600)).not.toThrow();
  });
});

describe("NullPipWindowResizer", () => {
  it("does nothing and does not throw", () => {
    expect(() => new NullPipWindowResizer().resize(800, 600)).not.toThrow();
  });
});

describe("detectPipResizer", () => {
  it("returns Electron when an electron API is present", () => {
    expect(detectPipResizer({ electronApi: mockElectronAPI(), isIframed: false }).name).toBe("electron");
  });
  it("returns Browser when iframed and no electron API", () => {
    expect(detectPipResizer({ electronApi: null, isIframed: true }).name).toBe("browser");
  });
  it("returns Null when neither", () => {
    expect(detectPipResizer({ electronApi: null, isIframed: false }).name).toBe("none");
  });
});
