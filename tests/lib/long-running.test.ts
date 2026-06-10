import { describe, it, expect } from "vitest";
import { isLongRunningTool, LONG_RUNNING_THRESHOLD_MS } from "@/lib/long-running";
import type { Agent, ActivityEntry } from "@/lib/providers/types";

const NOW = 1_700_000_000_000;

function makeAgent(overrides: Partial<Agent> = {}, lastEntryAge = 0): Agent {
  const entry: ActivityEntry = {
    timestamp: NOW - lastEntryAge,
    category: "executing",
    summary: "Bash: npm run build",
  };
  return {
    id: "claude-code:abc",
    provider: "claude-code",
    pid: 1,
    cwd: "/x",
    status: "busy",
    startedAt: NOW - 600_000,
    currentAction: "executing",
    recentActivity: [entry],
    hostApp: null,
    subagents: [],
    ...overrides,
  };
}

describe("isLongRunningTool", () => {
  it("is true for a busy agent stuck in a shell command past the threshold", () => {
    expect(isLongRunningTool(makeAgent({}, 90_000), NOW, 60_000)).toBe(true);
  });

  it("is true for a busy agent stuck in 'other' tool use past the threshold", () => {
    expect(isLongRunningTool(makeAgent({ currentAction: "other" }, 90_000), NOW, 60_000)).toBe(true);
  });

  it("is false while the tool call is still fresh", () => {
    expect(isLongRunningTool(makeAgent({}, 10_000), NOW, 60_000)).toBe(false);
  });

  it("is false at exactly the threshold boundary", () => {
    expect(isLongRunningTool(makeAgent({}, 60_000), NOW, 60_000)).toBe(false);
  });

  it("is false for non-tool actions even when stale", () => {
    expect(isLongRunningTool(makeAgent({ currentAction: "thinking" }, 90_000), NOW, 60_000)).toBe(false);
    expect(isLongRunningTool(makeAgent({ currentAction: "writing" }, 90_000), NOW, 60_000)).toBe(false);
    expect(isLongRunningTool(makeAgent({ currentAction: "waiting" }, 90_000), NOW, 60_000)).toBe(false);
  });

  it("is false for non-busy agents", () => {
    expect(isLongRunningTool(makeAgent({ status: "idle", currentAction: "idle" }, 90_000), NOW, 60_000)).toBe(false);
  });

  it("is false when there is no activity history", () => {
    expect(isLongRunningTool(makeAgent({ recentActivity: [] }), NOW, 60_000)).toBe(false);
  });

  it("defaults to the exported threshold", () => {
    const stale = makeAgent({}, LONG_RUNNING_THRESHOLD_MS + 1_000);
    expect(isLongRunningTool(stale, NOW)).toBe(true);
  });
});
