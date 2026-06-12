import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNow } from "@/hooks/use-now";

describe("useNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current time and re-renders every interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const { result } = renderHook(() => useNow(5_000));
    expect(result.current).toBe(1_700_000_000_000);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(1_700_000_005_000);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(1_700_000_015_000);
  });

  it("stops ticking after unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const { result, unmount } = renderHook(() => useNow(5_000));
    unmount();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toBe(1_700_000_000_000);
  });
});
