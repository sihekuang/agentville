import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
import { usePipHoverExpand } from "@/hooks/usePipHoverExpand";
import type { PipWindowResizer } from "@/lib/pip-resize";

function makeResizer() {
  return { name: "test", resize: vi.fn<(width: number, height: number) => void>() } satisfies PipWindowResizer;
}

// jsdom has no PointerEvent constructor; dispatch a MouseEvent with the pointer
// event *type* — the listeners only read clientX/clientY, which MouseEvent has.
function firePointerMove(x: number, y: number) {
  act(() => {
    document.documentElement.dispatchEvent(
      new MouseEvent("pointermove", { clientX: x, clientY: y }),
    );
  });
}
function firePointerLeave() {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent("pointerleave"));
  });
}

describe("usePipHoverExpand", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipHoverExpandEnabled: true, pipExpandWidth: 800 });
  });

  it("expands to the configured size when the pointer reaches the core", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerMove(200, 150); // center of the 400x300 collapsed window
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
  });

  it("does not expand while the pointer is only in the inset margin ring", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerMove(8, 150); // inside the window, outside the core
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses synchronously when the pointer leaves while expanded", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerMove(200, 150);
    resizer.resize.mockClear();
    firePointerLeave();
    expect(resizer.resize).toHaveBeenCalledWith(400, 300); // no timer
  });

  it("does nothing when the pointer leaves while still collapsed", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerLeave();
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("does not expand when disabled", () => {
    useAgentStore.setState({ pipHoverExpandEnabled: false });
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerMove(200, 150);
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses to the resting size once when disabled while expanded", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand({ resizer }));
    firePointerMove(200, 150);
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
    resizer.resize.mockClear();
    // Turning the feature off while expanded restores the resting size. The
    // store subscription re-renders the hook, so the effect re-runs with
    // enabled=false and collapses. No rerender() call needed.
    act(() => {
      useAgentStore.setState({ pipHoverExpandEnabled: false });
    });
    expect(resizer.resize).toHaveBeenCalledExactlyOnceWith(400, 300);
  });
});
