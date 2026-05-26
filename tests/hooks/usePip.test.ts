import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
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

describe("usePip", () => {
  let mockAPI: ReturnType<typeof makeMockElectronAPI>;

  beforeEach(() => {
    mockAPI = makeMockElectronAPI();
    useAgentStore.setState({ pipActive: false });
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns supported: false when no PIP API available", () => {
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(false);
    expect(result.current.backend).toBeNull();
  });

  it("returns backend: electron when electronAPI is present", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("electron");
  });

  it("returns backend: browser when documentPictureInPicture is present", () => {
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("browser");
  });

  it("prefers electron over browser when both available", () => {
    (window as any).electronAPI = mockAPI;
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { result } = renderHook(() => usePip());
    expect(result.current.backend).toBe("electron");
  });

  it("activate() calls electronAPI.pipActivate in electron mode", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.activate();
    });
    expect(mockAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("activate() is a no-op when already active", async () => {
    (window as any).electronAPI = mockAPI;
    useAgentStore.setState({ pipActive: true });
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.activate();
    });
    expect(mockAPI.pipActivate).not.toHaveBeenCalled();
  });

  it("deactivate() calls electronAPI.pipDeactivate in electron mode", async () => {
    (window as any).electronAPI = mockAPI;
    useAgentStore.setState({ pipActive: true });
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.deactivate();
    });
    expect(mockAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("deactivate() is a no-op when already inactive", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.deactivate();
    });
    expect(mockAPI.pipDeactivate).not.toHaveBeenCalled();
  });

  it("toggle() activates when inactive", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("toggle() deactivates when active", async () => {
    (window as any).electronAPI = mockAPI;
    useAgentStore.setState({ pipActive: true });
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("focusMain() calls electronAPI.pipFocusMain in electron mode", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip());
    result.current.focusMain();
    expect(mockAPI.pipFocusMain).toHaveBeenCalledOnce();
  });

  it("focusMain() is a no-op when not in electron", () => {
    const { result } = renderHook(() => usePip());
    result.current.focusMain();
    // Should not throw
  });
});
