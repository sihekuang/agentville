import { describe, it, expect, vi } from "vitest";

// Mock pixi.js before importing
vi.mock("pixi.js", () => {
  class MockRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x: number, y: number, w: number, h: number) {
      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
    }
  }
  class MockTexture {
    source: unknown;
    frame: MockRectangle;
    constructor({ source, frame }: { source: unknown; frame: MockRectangle }) {
      this.source = source;
      this.frame = frame;
    }
  }
  return {
    Texture: MockTexture,
    Rectangle: MockRectangle,
    Assets: { load: vi.fn() },
  };
});

import { sliceFrames } from "@/components/scene/use-animation-frames";
import { Texture } from "pixi.js";

describe("sliceFrames", () => {
  const mockBaseTexture = {
    source: { label: "test-source" },
  } as unknown as Texture;

  it("returns correct number of frames for a 2-frame animation", () => {
    const anim = { row: 0, frames: 2, speed: 0.02 };
    const result = sliceFrames(mockBaseTexture, anim, 32, 32);
    expect(result).toHaveLength(2);
  });

  it("returns correct number of frames for a 4-frame animation", () => {
    const anim = { row: 1, frames: 4, speed: 0.05 };
    const result = sliceFrames(mockBaseTexture, anim, 32, 32);
    expect(result).toHaveLength(4);
  });

  it("creates textures with correct frame rectangles", () => {
    const anim = { row: 2, frames: 3, speed: 0.03 };
    const result = sliceFrames(mockBaseTexture, anim, 32, 32);

    // Frame 0: x=0, y=row*height=64
    expect(result[0].frame.x).toBe(0);
    expect(result[0].frame.y).toBe(64);
    expect(result[0].frame.width).toBe(32);
    expect(result[0].frame.height).toBe(32);

    // Frame 1: x=32
    expect(result[1].frame.x).toBe(32);
    expect(result[1].frame.y).toBe(64);

    // Frame 2: x=64
    expect(result[2].frame.x).toBe(64);
    expect(result[2].frame.y).toBe(64);
  });

  it("uses the base texture source for all frames", () => {
    const anim = { row: 0, frames: 2, speed: 0.02 };
    const result = sliceFrames(mockBaseTexture, anim, 32, 32);
    for (const tex of result) {
      expect(tex.source).toBe(mockBaseTexture.source);
    }
  });

  it("handles different frame dimensions", () => {
    const anim = { row: 1, frames: 2, speed: 0.04 };
    const result = sliceFrames(mockBaseTexture, anim, 48, 64);

    expect(result[0].frame.x).toBe(0);
    expect(result[0].frame.y).toBe(64); // row 1 * 64
    expect(result[0].frame.width).toBe(48);
    expect(result[0].frame.height).toBe(64);

    expect(result[1].frame.x).toBe(48);
    expect(result[1].frame.y).toBe(64);
  });

  it("returns empty array for zero frames", () => {
    const anim = { row: 0, frames: 0, speed: 0.02 };
    const result = sliceFrames(mockBaseTexture, anim, 32, 32);
    expect(result).toHaveLength(0);
  });
});
