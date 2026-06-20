import { describe, it, expect } from "vitest";
import { computeResizedBounds, isCursorBeyond } from "../../electron/pip-bounds";

const workArea = { x: 0, y: 0, width: 1440, height: 900 };

describe("computeResizedBounds", () => {
  it("keeps the window centered on its current center", () => {
    // 400x300 centered at (600,500); grow to 800x600 -> top-left (200,200)
    const current = { x: 400, y: 350, width: 400, height: 300 };
    const next = computeResizedBounds(current, 800, 600, workArea);
    expect(next).toEqual({ x: 200, y: 200, width: 800, height: 600 });
  });

  it("clamps a bottom-right docked window so it stays on screen", () => {
    // Docked bottom-right: 400x300 at (1020,580). Grow to 800x600.
    const current = { x: 1020, y: 580, width: 400, height: 300 };
    const next = computeResizedBounds(current, 800, 600, workArea);
    // Right/bottom edges clamp to the work area.
    expect(next.x + next.width).toBeLessThanOrEqual(workArea.width);
    expect(next.y + next.height).toBeLessThanOrEqual(workArea.height);
    expect(next.x).toBe(640); // 1440 - 800
    expect(next.y).toBe(300); // 900 - 600
  });

  it("caps the size to the work area when the target is too large", () => {
    const current = { x: 0, y: 0, width: 400, height: 300 };
    const next = computeResizedBounds(current, 5000, 5000, workArea);
    expect(next.width).toBe(workArea.width);
    expect(next.height).toBe(workArea.height);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  it("respects a non-zero work-area origin (second display)", () => {
    const secondary = { x: 1440, y: 0, width: 1280, height: 800 };
    const current = { x: 1500, y: 600, width: 400, height: 300 };
    const next = computeResizedBounds(current, 800, 600, secondary);
    expect(next.x).toBeGreaterThanOrEqual(secondary.x);
    expect(next.x + next.width).toBeLessThanOrEqual(secondary.x + secondary.width);
    expect(next.y + next.height).toBeLessThanOrEqual(secondary.y + secondary.height);
  });
});

describe("isCursorBeyond", () => {
  // window covers x∈[100,900], y∈[100,700]; outset 60 → boundary x∈[40,960], y∈[40,760]
  const bounds = { x: 100, y: 100, width: 800, height: 600 };
  const outset = 60;

  it("is false when the cursor is inside the window", () => {
    expect(isCursorBeyond({ x: 500, y: 400 }, bounds, outset)).toBe(false);
  });

  it("is false within the outset buffer past an edge", () => {
    expect(isCursorBeyond({ x: 940, y: 400 }, bounds, outset)).toBe(false); // right buffer
    expect(isCursorBeyond({ x: 60, y: 400 }, bounds, outset)).toBe(false);  // left buffer
  });

  it("is true more than outset past the left/right edges", () => {
    expect(isCursorBeyond({ x: 961, y: 400 }, bounds, outset)).toBe(true);
    expect(isCursorBeyond({ x: 39, y: 400 }, bounds, outset)).toBe(true);
  });

  it("is true more than outset past the top/bottom edges", () => {
    expect(isCursorBeyond({ x: 500, y: 39 }, bounds, outset)).toBe(true);
    expect(isCursorBeyond({ x: 500, y: 761 }, bounds, outset)).toBe(true);
  });

  it("respects a second-display (non-zero origin) window", () => {
    const secondary = { x: 1440, y: 0, width: 800, height: 600 };
    expect(isCursorBeyond({ x: 1800, y: 300 }, secondary, 60)).toBe(false);
    expect(isCursorBeyond({ x: 1440 + 800 + 61, y: 300 }, secondary, 60)).toBe(true);
  });
});
