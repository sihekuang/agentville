import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
import { usePipHoverExpand } from "@/hooks/usePipHoverExpand";
import { PIP_HOVER, type PipWindowResizer, type PipCursorProbe } from "@/lib/pip-resize";

function makeResizer() {
  return { name: "test", resize: vi.fn<(width: number, height: number) => void>() } satisfies PipWindowResizer;
}

// Controllable probe: flip `state.beyond` to simulate the cursor crossing the buffer.
function makeProbe(initial = false) {
  const state = { beyond: initial };
  const probe: PipCursorProbe = { name: "test", isBeyond: vi.fn(async () => state.beyond) };
  return { probe, state };
}

// jsdom has no PointerEvent constructor; dispatch a MouseEvent with the pointer
// event type — the listeners only read clientX/clientY, which MouseEvent has.
function firePointerMove(x: number, y: number) {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y }));
  });
}
function firePointer(type: "pointerleave" | "pointerenter") {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent(type));
  });
}

describe("usePipHoverExpand", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipHoverExpandEnabled: true, pipExpandWidth: 800 });
  });

  it("expands to the configured size when the pointer reaches the core", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
  });

  it("does not expand while the pointer is only in the inset margin ring", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
    firePointerMove(8, 150);
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("stays expanded while the cursor is in the buffer, collapses once it is beyond", async () => {
    vi.useFakeTimers();
    try {
      const resizer = makeResizer();
      const { probe, state } = makeProbe(false); // inside the buffer
      renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
      firePointerMove(200, 150);                 // expand
      expect(resizer.resize).toHaveBeenCalledWith(800, 600);
      resizer.resize.mockClear();
      firePointer("pointerleave");               // start the watch
      await act(async () => { await vi.advanceTimersByTimeAsync(PIP_HOVER.COLLAPSE_POLL_MS); });
      expect(resizer.resize).not.toHaveBeenCalled(); // still in buffer → stays expanded
      state.beyond = true;                       // cursor crosses the boundary
      await act(async () => { await vi.advanceTimersByTimeAsync(PIP_HOVER.COLLAPSE_POLL_MS); });
      expect(resizer.resize).toHaveBeenCalledWith(400, 300);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending collapse when the cursor returns over the window", async () => {
    vi.useFakeTimers();
    try {
      const resizer = makeResizer();
      const { probe, state } = makeProbe(false);
      renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
      firePointerMove(200, 150);                 // expand
      resizer.resize.mockClear();
      firePointer("pointerleave");               // start watch
      firePointer("pointerenter");               // back over the window → stop watch
      state.beyond = true;                       // would report beyond now
      await act(async () => { await vi.advanceTimersByTimeAsync(PIP_HOVER.COLLAPSE_POLL_MS * 3); });
      expect(resizer.resize).not.toHaveBeenCalledWith(400, 300);
    } finally {
      vi.useRealTimers();
    }
  });

  it("collapses one tick after leave when the probe reports beyond immediately", async () => {
    vi.useFakeTimers();
    try {
      const resizer = makeResizer();
      const { probe } = makeProbe(true);         // e.g. non-Electron NullPipCursorProbe
      renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
      firePointerMove(200, 150);
      resizer.resize.mockClear();
      firePointer("pointerleave");
      await act(async () => { await vi.advanceTimersByTimeAsync(PIP_HOVER.COLLAPSE_POLL_MS); });
      expect(resizer.resize).toHaveBeenCalledWith(400, 300);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not expand when disabled", () => {
    useAgentStore.setState({ pipHoverExpandEnabled: false });
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses to the resting size once when disabled while expanded", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipHoverExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
    resizer.resize.mockClear();
    act(() => {
      useAgentStore.setState({ pipHoverExpandEnabled: false });
    });
    expect(resizer.resize).toHaveBeenCalledExactlyOnceWith(400, 300);
  });
});
