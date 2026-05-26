import { describe, it, expect, beforeEach } from "vitest";
import {
  PIP_CONFIG,
  IPC,
  isElectron,
  getElectronAPI,
} from "@/lib/pip-types";

describe("PIP_CONFIG", () => {
  it("has consistent dimensions", () => {
    expect(PIP_CONFIG.WIDTH).toBeGreaterThan(PIP_CONFIG.MIN_WIDTH);
    expect(PIP_CONFIG.HEIGHT).toBeGreaterThan(PIP_CONFIG.MIN_HEIGHT);
  });

  it("has a valid PIP route", () => {
    expect(PIP_CONFIG.PIP_ROUTE).toBe("/pip");
  });
});

describe("IPC constants", () => {
  it("defines all required channels", () => {
    expect(IPC.PIP_ACTIVATE).toBe("pip:activate");
    expect(IPC.PIP_DEACTIVATE).toBe("pip:deactivate");
    expect(IPC.PIP_FOCUS_MAIN).toBe("pip:focus-main");
    expect(IPC.PIP_ACTIVATED).toBe("pip:activated");
    expect(IPC.PIP_DEACTIVATED).toBe("pip:deactivated");
  });

  it("all channel names are unique", () => {
    const values = Object.values(IPC);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("isElectron", () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
  });

  it("returns false when electronAPI is not on window", () => {
    expect(isElectron()).toBe(false);
  });

  it("returns true when electronAPI is on window", () => {
    (window as any).electronAPI = { pipActivate: () => {} };
    expect(isElectron()).toBe(true);
  });
});

describe("getElectronAPI", () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
  });

  it("returns null when not in Electron", () => {
    expect(getElectronAPI()).toBeNull();
  });

  it("returns null when electronAPI exists but pipActivate is not a function", () => {
    (window as any).electronAPI = { pipActivate: "not-a-function" };
    expect(getElectronAPI()).toBeNull();
  });

  it("returns the API when valid", () => {
    const mockAPI = {
      pipActivate: () => {},
      pipDeactivate: () => {},
      pipFocusMain: () => {},
      onPipActivated: () => () => {},
      onPipDeactivated: () => () => {},
    };
    (window as any).electronAPI = mockAPI;
    expect(getElectronAPI()).toBe(mockAPI);
  });
});
