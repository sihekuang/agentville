import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { PipProvider } from "@/contexts/PipContext";
import { usePip } from "@/hooks/usePip";
import {
  ElectronPipBackend,
  NullPipBackend,
  type PipBackendAdapter,
} from "@/lib/pip-backend";

function makeMockElectronAPI() {
  return {
    pipActivate: vi.fn() as unknown as () => void,
    pipDeactivate: vi.fn() as unknown as () => void,
    pipFocusMain: vi.fn() as unknown as () => void,
    onPipActivated: vi.fn((_cb: () => void) => () => {}) as (cb: () => void) => () => void,
    onPipDeactivated: vi.fn((_cb: () => void) => () => {}) as (cb: () => void) => () => void,
  };
}

function makeWrapper(backend: PipBackendAdapter) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(PipProvider, { backend, children });
  };
}

describe("usePip", () => {
  let mockAPI: ReturnType<typeof makeMockElectronAPI>;

  beforeEach(() => {
    mockAPI = makeMockElectronAPI();
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns supported: false with NullPipBackend", () => {
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new NullPipBackend()),
    });
    expect(result.current.supported).toBe(false);
    expect(result.current.backend).toBeNull();
  });

  it("returns backend: electron with ElectronPipBackend", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new ElectronPipBackend()),
    });
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("electron");
  });

  it("activate() delegates to backend", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new ElectronPipBackend()),
    });
    await act(async () => {
      await result.current.activate();
    });
    expect(vi.mocked(mockAPI.pipActivate)).toHaveBeenCalledOnce();
  });

  it("deactivate() delegates to backend when active", async () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new ElectronPipBackend()),
    });
    await act(async () => {
      await result.current.activate();
    });
    // Simulate IPC callback
    const onActivatedMock = vi.mocked(mockAPI.onPipActivated);
    const activatedCb = onActivatedMock.mock.calls[0]?.[0];
    if (activatedCb) act(() => activatedCb());

    await act(async () => {
      await result.current.deactivate();
    });
    expect(vi.mocked(mockAPI.pipDeactivate)).toHaveBeenCalledOnce();
  });

  it("focusMain() delegates to backend", () => {
    (window as any).electronAPI = mockAPI;
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new ElectronPipBackend()),
    });
    result.current.focusMain();
    expect(vi.mocked(mockAPI.pipFocusMain)).toHaveBeenCalledOnce();
  });

  it("focusMain() is safe with NullPipBackend", () => {
    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(new NullPipBackend()),
    });
    expect(() => result.current.focusMain()).not.toThrow();
  });

  it("throws when used outside PipProvider", () => {
    expect(() => {
      renderHook(() => usePip());
    }).toThrow("usePipContext must be used within a PipProvider");
  });

  it("accepts a custom mock backend via DI", async () => {
    const mockBackend: PipBackendAdapter = {
      name: "test",
      activate: vi.fn().mockResolvedValue(undefined),
      deactivate: vi.fn().mockResolvedValue(undefined),
      focusMain: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const { result } = renderHook(() => usePip(), {
      wrapper: makeWrapper(mockBackend),
    });

    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("test");

    await act(async () => {
      await result.current.activate();
    });
    expect(mockBackend.activate).toHaveBeenCalledOnce();

    result.current.focusMain();
    expect(mockBackend.focusMain).toHaveBeenCalledOnce();
  });
});
