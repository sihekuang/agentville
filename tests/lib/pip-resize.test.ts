import { afterEach, describe, it, expect, vi } from "vitest";
import {
  PIP_EXPAND,
  clampExpandWidth,
  expandedSize,
  ElectronPipWindowResizer,
  BrowserPipWindowResizer,
  NullPipWindowResizer,
  detectPipResizer,
  PIP_HOVER,
  pipHoverAction,
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

describe("pipHoverAction", () => {
  const collapsed = { width: 400, height: 300 }; // center (200,150)

  it("expands when collapsed and the pointer is in the core", () => {
    expect(pipHoverAction({ x: 200, y: 150 }, false, collapsed)).toBe("expand");
  });

  it("does not expand when the pointer is only in the inset margin ring", () => {
    // x=8 → dx=192 > ex(168): inside the window but not the 336x236 core
    expect(pipHoverAction({ x: 8, y: 150 }, false, collapsed)).toBe("none");
  });

  it("treats the core boundary as inclusive", () => {
    // corner of the core: dx=168 (=200-32), dy=118 (=150-32)
    expect(pipHoverAction({ x: 368, y: 268 }, false, collapsed)).toBe("expand");
    // one pixel past → none
    expect(pipHoverAction({ x: 369, y: 268 }, false, collapsed)).toBe("none");
  });

  it("returns none when collapsed and the pointer has left the window", () => {
    expect(pipHoverAction(null, false, collapsed)).toBe("none");
  });

  it("collapses when expanded and the pointer has left the window", () => {
    expect(pipHoverAction(null, true, collapsed)).toBe("collapse");
  });

  it("stays expanded while the pointer is anywhere inside the window", () => {
    expect(pipHoverAction({ x: 5, y: 5 }, true, collapsed)).toBe("none");
  });

  it("respects a custom inset", () => {
    // (90,150): dx=110. Default inset 32 → expand; inset 100 → ex=100 → none.
    expect(pipHoverAction({ x: 90, y: 150 }, false, collapsed)).toBe("expand");
    expect(pipHoverAction({ x: 90, y: 150 }, false, collapsed, 100)).toBe("none");
  });

  it("exposes the default inset as 32", () => {
    expect(PIP_HOVER.EXPAND_INSET).toBe(32);
  });
});
