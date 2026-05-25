import { describe, it, expect, vi } from "vitest";

// Mock pixi.js and @pixi/react to avoid module resolution issues in tests
vi.mock("pixi.js", () => ({
  Container: class {},
  Text: class {},
}));

vi.mock("@pixi/react", () => ({
  extend: vi.fn(),
  useTick: vi.fn(),
}));

import { createParticle, updateParticle, shouldSpawn } from "@/components/scene/AgentParticles";

describe("particle lifecycle", () => {
  it("createParticle returns valid initial state", () => {
    const p = createParticle(
      { text: "{", color: 0x80b0e0, fontSize: 4 },
      { dx: 0, dy: -10 },
      { min: 0.8, max: 1.5 },
    );
    expect(p.age).toBe(0);
    expect(p.lifetime).toBeGreaterThanOrEqual(0.8);
    expect(p.lifetime).toBeLessThanOrEqual(1.5);
    expect(p.text).toBe("{");
    expect(p.x).toBeGreaterThanOrEqual(-8);
    expect(p.x).toBeLessThanOrEqual(8);
  });

  it("updateParticle advances age and position", () => {
    const p = createParticle(
      { text: "·", color: 0xffffff, fontSize: 2 },
      { dx: 0, dy: -10 },
      { min: 1.0, max: 1.0 },
    );
    const startY = p.y;
    updateParticle(p, 0.5);
    expect(p.age).toBe(0.5);
    expect(p.y).toBeLessThan(startY); // drifted up (dy is negative)
  });

  it("updateParticle fades alpha correctly", () => {
    const p = createParticle(
      { text: "·", color: 0xffffff, fontSize: 2 },
      { dx: 0, dy: -10 },
      { min: 1.0, max: 1.0 },
    );
    // At 10% progress (in fade-in zone)
    updateParticle(p, 0.1);
    expect(p.alpha).toBeLessThan(0.6);
    expect(p.alpha).toBeGreaterThan(0);

    // At 50% (in hold zone)
    p.age = 0;
    updateParticle(p, 0.5);
    expect(p.alpha).toBeCloseTo(0.6, 1);
  });

  it("particle is dead when age exceeds lifetime", () => {
    const p = createParticle(
      { text: "·", color: 0xffffff, fontSize: 2 },
      { dx: 0, dy: -10 },
      { min: 1.0, max: 1.0 },
    );
    updateParticle(p, 1.1);
    expect(p.age).toBeGreaterThan(p.lifetime);
  });

  it("shouldSpawn respects rate probability", () => {
    let spawns = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSpawn(0.5, 0.016)) spawns++;
    }
    expect(spawns).toBeGreaterThan(0);
    expect(spawns).toBeLessThan(100);
  });
});
