import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ElectronPipBackend,
  BrowserPipBackend,
  NullPipBackend,
  detectBackend,
} from "@/lib/pip-backend";
import type { ElectronPipAPI } from "@/lib/pip-types";

function makeMockElectronAPI(): ElectronPipAPI {
  return {
    pipActivate: vi.fn(),
    pipDeactivate: vi.fn(),
    pipFocusMain: vi.fn(),
    pipResize: vi.fn(),
    pipCursorBeyond: vi.fn(),
    onPipActivated: vi.fn(() => () => {}),
    onPipDeactivated: vi.fn(() => () => {}),
    onPipBlur: vi.fn(() => () => {}),
  };
}

describe("ElectronPipBackend", () => {
  let mockAPI: ElectronPipAPI;

  beforeEach(() => {
    mockAPI = makeMockElectronAPI();
    (window as any).electronAPI = mockAPI;
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it("has name 'electron'", () => {
    expect(new ElectronPipBackend().name).toBe("electron");
  });

  it("activate() calls pipActivate", async () => {
    const backend = new ElectronPipBackend();
    await backend.activate();
    expect(mockAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("deactivate() calls pipDeactivate", async () => {
    const backend = new ElectronPipBackend();
    await backend.deactivate();
    expect(mockAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("focusMain() calls pipFocusMain", () => {
    const backend = new ElectronPipBackend();
    backend.focusMain();
    expect(mockAPI.pipFocusMain).toHaveBeenCalledOnce();
  });

  it("subscribe() listens for activated/deactivated", () => {
    const backend = new ElectronPipBackend();
    const onActivated = vi.fn();
    const onDeactivated = vi.fn();
    const unsubscribe = backend.subscribe(onActivated, onDeactivated);

    expect(mockAPI.onPipActivated).toHaveBeenCalledOnce();
    expect(mockAPI.onPipDeactivated).toHaveBeenCalledOnce();

    unsubscribe();
  });
});

describe("BrowserPipBackend", () => {
  it("has name 'browser'", () => {
    expect(new BrowserPipBackend().name).toBe("browser");
  });

  it("focusMain() is a no-op (does not throw)", () => {
    const backend = new BrowserPipBackend();
    expect(() => backend.focusMain()).not.toThrow();
  });
});

describe("NullPipBackend", () => {
  it("has name 'none'", () => {
    expect(new NullPipBackend().name).toBe("none");
  });

  it("all methods are no-ops", async () => {
    const backend = new NullPipBackend();
    await backend.activate();
    await backend.deactivate();
    backend.focusMain();
    const unsub = backend.subscribe(() => {}, () => {});
    unsub();
  });
});

describe("detectBackend", () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns NullPipBackend when no APIs available", () => {
    const backend = detectBackend();
    expect(backend.name).toBe("none");
  });

  it("returns ElectronPipBackend when electronAPI is present", () => {
    (window as any).electronAPI = makeMockElectronAPI();
    const backend = detectBackend();
    expect(backend.name).toBe("electron");
  });

  it("returns BrowserPipBackend when documentPictureInPicture is present", () => {
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const backend = detectBackend();
    expect(backend.name).toBe("browser");
  });

  it("prefers Electron over browser", () => {
    (window as any).electronAPI = makeMockElectronAPI();
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const backend = detectBackend();
    expect(backend.name).toBe("electron");
  });
});
