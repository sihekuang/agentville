import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";
import { usePipExpand } from "@/hooks/usePipExpand";
import { PIP_HOVER, type PipWindowResizer, type PipCursorProbe } from "@/lib/pip-resize";
import { PIP_EXPAND_REQUEST_EVENT } from "@/lib/pip-types";

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
function firePointerDown() {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent("pointerdown"));
  });
}
function fireWindowBlur() {
  act(() => {
    window.dispatchEvent(new Event("blur"));
  });
}
// The scene fires this only for empty-canvas presses (not agents/buttons).
function fireExpandRequest() {
  act(() => {
    window.dispatchEvent(new Event(PIP_EXPAND_REQUEST_EVENT));
  });
}

describe("usePipExpand — hover mode", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipExpandTrigger: "hover", pipExpandWidth: 800 });
  });

  it("expands to the configured size when the pointer reaches the core", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
  });

  it("does not expand while the pointer is only in the inset margin ring", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    firePointerMove(8, 150);
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("stays expanded while the cursor is in the buffer, collapses once it is beyond", async () => {
    vi.useFakeTimers();
    try {
      const resizer = makeResizer();
      const { probe, state } = makeProbe(false); // inside the buffer
      renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
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
      renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
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
      renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
      firePointerMove(200, 150);
      resizer.resize.mockClear();
      firePointer("pointerleave");
      await act(async () => { await vi.advanceTimersByTimeAsync(PIP_HOVER.COLLAPSE_POLL_MS); });
      expect(resizer.resize).toHaveBeenCalledWith(400, 300);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("usePipExpand — click mode", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipExpandTrigger: "click", pipExpandWidth: 800 });
  });

  it("expands on an empty-canvas expand request from the scene", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    fireExpandRequest();
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
  });

  it("does NOT expand on a raw document pointerdown (agent/button clicks never emit a request)", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    firePointerDown();             // a click that did not hit empty canvas
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses when the window loses focus (click outside)", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    fireExpandRequest();           // expand
    resizer.resize.mockClear();
    fireWindowBlur();              // clicked outside → collapse
    expect(resizer.resize).toHaveBeenCalledWith(400, 300);
  });

  it("stays expanded on a second request (click-out collapses, not a toggle)", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    fireExpandRequest();           // expand
    resizer.resize.mockClear();
    fireExpandRequest();           // already expanded → no change
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("ignores blur while collapsed", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    fireWindowBlur();
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses when switching away from click while expanded (no orphaned window)", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    fireExpandRequest();           // expand under click mode
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
    resizer.resize.mockClear();
    act(() => { useAgentStore.setState({ pipExpandTrigger: "off" }); });
    expect(resizer.resize).toHaveBeenCalledExactlyOnceWith(400, 300);
  });
});

describe("usePipExpand — off mode", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipExpandTrigger: "off", pipExpandWidth: 800 });
  });

  it("does not expand on hover, pointerdown, or an expand request", () => {
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);
    firePointerDown();
    fireExpandRequest();
    expect(resizer.resize).not.toHaveBeenCalled();
  });

  it("collapses to the resting size once when switched to off while expanded (via hover)", () => {
    useAgentStore.setState({ pipExpandTrigger: "hover" });
    const resizer = makeResizer();
    const { probe } = makeProbe();
    renderHook(() => usePipExpand({ resizer, cursorProbe: probe }));
    firePointerMove(200, 150);     // expand under hover
    expect(resizer.resize).toHaveBeenCalledWith(800, 600);
    resizer.resize.mockClear();
    act(() => { useAgentStore.setState({ pipExpandTrigger: "off" }); });
    expect(resizer.resize).toHaveBeenCalledExactlyOnceWith(400, 300);
  });
});
