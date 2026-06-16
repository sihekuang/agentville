import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
import { usePipHoverExpand } from "@/hooks/usePipHoverExpand";
import type { PipWindowResizer } from "@/lib/pip-resize";

function makeResizer() {
  return { name: "test", resize: vi.fn<(width: number, height: number) => void>() } satisfies PipWindowResizer;
}

function fireMouse(type: "mouseenter" | "mouseleave") {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent(type));
  });
}

describe("usePipHoverExpand", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipHoverExpandEnabled: true, pipExpandWidth: 800 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expands to the configured size on mouseenter when enabled", () => {
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand(resizer));
    fireMouse("mouseenter");
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
  });

  it("collapses to the resting size after the delay on mouseleave", () => {
    vi.useFakeTimers();
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand(resizer));
    fireMouse("mouseenter");
    resizer.resize.mockClear();
    fireMouse("mouseleave");
    expect(resizer.resize).not.toHaveBeenCalled(); // delayed
    act(() => { vi.advanceTimersByTime(300); });
    expect(resizer.resize).toHaveBeenCalledWith(400, 300);
  });

  it("does not expand when disabled", () => {
    useAgentStore.setState({ pipHoverExpandEnabled: false });
    const resizer = makeResizer();
    renderHook(() => usePipHoverExpand(resizer));
    fireMouse("mouseenter");
    expect(resizer.resize).not.toHaveBeenCalled();
  });
});
