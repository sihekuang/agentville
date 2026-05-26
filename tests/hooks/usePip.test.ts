import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
import { usePip } from "@/hooks/usePip";

const mockElectronAPI = {
  pipActivate: vi.fn(),
  pipDeactivate: vi.fn(),
  onPipActivated: vi.fn(() => () => {}),
  onPipDeactivated: vi.fn(() => () => {}),
};

describe("usePip", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipActive: false });
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns supported: false when no PIP API available", () => {
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(false);
  });

  it("returns backend: electron when electronAPI is present", () => {
    (window as any).electronAPI = mockElectronAPI;
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
    (window as any).electronAPI = mockElectronAPI;
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { result } = renderHook(() => usePip());
    expect(result.current.backend).toBe("electron");
  });

  it("activate() calls electronAPI.pipActivate in electron mode", async () => {
    (window as any).electronAPI = mockElectronAPI;
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.activate();
    });
    expect(mockElectronAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("deactivate() calls electronAPI.pipDeactivate in electron mode", async () => {
    (window as any).electronAPI = mockElectronAPI;
    useAgentStore.setState({ pipActive: true });
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.deactivate();
    });
    expect(mockElectronAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("toggle() activates when inactive", async () => {
    (window as any).electronAPI = mockElectronAPI;
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockElectronAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("toggle() deactivates when active", async () => {
    (window as any).electronAPI = mockElectronAPI;
    useAgentStore.setState({ pipActive: true });
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockElectronAPI.pipDeactivate).toHaveBeenCalledOnce();
  });
});
