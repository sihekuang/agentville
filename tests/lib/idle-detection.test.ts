import { describe, it, expect } from "vitest";
import {
  applyIdleOverride,
  parseIdleTimeoutParam,
  DEFAULT_IDLE_TIMEOUT_MS,
} from "@/lib/idle-detection";
import type { Agent } from "@/lib/providers/types";

const NOW = 1_700_000_000_000;

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "claude-code:abc",
    provider: "claude-code",
    pid: 1,
    cwd: "/x",
    status: "busy",
    startedAt: NOW - 120_000,
    currentAction: "executing",
    recentActivity: [],
    hostApp: null,
    subagents: [],
    lastTokenActivityAt: NOW - 120_000,
    ...overrides,
  };
}

describe("applyIdleOverride", () => {
  it("flips a busy agent with stale token flow to idle", () => {
    const out = applyIdleOverride(makeAgent({ lastTokenActivityAt: NOW - 90_000 }), NOW, 60_000);
    expect(out.status).toBe("idle");
    expect(out.currentAction).toBe("idle");
  });

  it("leaves a busy agent with fresh token flow unchanged", () => {
    const a = makeAgent({ lastTokenActivityAt: NOW - 10_000 });
    expect(applyIdleOverride(a, NOW, 60_000)).toBe(a);
  });

  it("preserves a waiting agent even when token flow is stale", () => {
    const a = makeAgent({ currentAction: "waiting", lastTokenActivityAt: NOW - 600_000 });
    expect(applyIdleOverride(a, NOW, 60_000)).toBe(a);
  });

  it("leaves an already-idle agent unchanged", () => {
    const a = makeAgent({ status: "idle", currentAction: "idle", lastTokenActivityAt: NOW - 600_000 });
    expect(applyIdleOverride(a, NOW, 60_000)).toBe(a);
  });

  it("does not override when the token-flow signal is unknown (fail-safe)", () => {
    const a = makeAgent({ lastTokenActivityAt: undefined });
    expect(applyIdleOverride(a, NOW, 60_000)).toBe(a);
  });

  it("does not demote at exactly the timeout boundary", () => {
    const a = makeAgent({ lastTokenActivityAt: NOW - 60_000 });
    expect(applyIdleOverride(a, NOW, 60_000).status).toBe("busy");
  });

  it("never demotes when the timeout is Infinity (Off)", () => {
    const a = makeAgent({ lastTokenActivityAt: NOW - 10_000_000 });
    expect(applyIdleOverride(a, NOW, Number.POSITIVE_INFINITY).status).toBe("busy");
  });
});

describe("parseIdleTimeoutParam", () => {
  it("returns the default when missing", () => {
    expect(parseIdleTimeoutParam(null)).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });
  it("returns Infinity for 'off'", () => {
    expect(parseIdleTimeoutParam("off")).toBe(Number.POSITIVE_INFINITY);
  });
  it("clamps below the minimum", () => {
    expect(parseIdleTimeoutParam("1000")).toBe(5_000);
  });
  it("clamps above the maximum", () => {
    expect(parseIdleTimeoutParam("99999999")).toBe(3_600_000);
  });
  it("passes a valid value through", () => {
    expect(parseIdleTimeoutParam("120000")).toBe(120_000);
  });
  it("falls back to default on garbage", () => {
    expect(parseIdleTimeoutParam("abc")).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });
});
