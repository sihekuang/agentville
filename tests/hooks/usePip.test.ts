import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { PipProvider } from "@/contexts/PipContext";
import { usePip } from "@/hooks/usePip";
import type { ElectronPipAPI } from "@/lib/pip-types";

function makeMockElectronAPI(): ElectronPipAPI & {
  pipActivate: ReturnType<typeof vi.fn>;
  pipDeactivate: ReturnType<typeof vi.fn>;
  pipFocusMain: ReturnType<typeof vi.fn>;
} {
  return {
    pipActivate: vi.fn(),
    pipDeactivate: vi.fn(),
    pipFocusMain: vi.fn(),
    onPipActivated: vi.fn(() => () => {}),
    onPipDeactivated: vi.fn(() => () => {}),
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PipProvider, null, children);
}

describe("usePip", () => {
  let mockAPI: ReturnType<typeof makeMockElectronAPI>;

  beforeEach(() => {
    mockAPI = makeMockElectronAPI();
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns supported: false when no PIP API available", () => {
    const { result } = renderHook(() => usePip(), { wrapper });
    expect(result.current.supported).toBe(false);
    expect(result.current.backend).toBeNull();
  });

  it("returns backend: electron when electronAPI is present", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), { wrapper });
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("electron");
  });

  it("returns backend: browser when documentPictureInPicture is present", () => {
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { result } = renderHook(() => usePip(), { wrapper });
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("browser");
  });

  it("prefers electron over browser when both available", () => {
    (window as any).electronAPI = mockAPI;
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { result } = renderHook(() => usePip(), { wrapper });
    expect(result.current.backend).toBe("electron");
  });

  it("activate() calls electronAPI.pipActivate in electron mode", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), { wrapper });
    await act(async () => {
      await result.current.activate();
    });
    expect(mockAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("deactivate() calls electronAPI.pipDeactivate in electron mode", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), { wrapper });
    // First activate
    await act(async () => {
      await result.current.activate();
    });
    // Simulate the IPC callback setting active=true
    const onActivated = mockAPI.onPipActivated.mock.calls[0]?.[0];
    if (onActivated) {
      act(() => onActivated());
    }
    await act(async () => {
      await result.current.deactivate();
    });
    expect(mockAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("focusMain() calls electronAPI.pipFocusMain in electron mode", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), { wrapper });
    result.current.focusMain();
    expect(mockAPI.pipFocusMain).toHaveBeenCalledOnce();
  });

  it("focusMain() is a no-op when not in electron", () => {
    const { result } = renderHook(() => usePip(), { wrapper });
    result.current.focusMain();
    // Should not throw
  });

  it("throws when used outside PipProvider", () => {
    expect(() => {
      renderHook(() => usePip());
    }).toThrow("usePipContext must be used within a PipProvider");
  });
});
