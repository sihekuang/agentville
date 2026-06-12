import { describe, it, expect } from "vitest";
import { isLongRunningState, LONG_RUNNING_THRESHOLD_MS } from "@/lib/long-running";
import type { Agent, ActivityEntry, NormalizedAction } from "@/lib/providers/types";

const NOW = 1_700_000_000_000;

function entry(
  category: NormalizedAction,
  age: number,
  opts: Partial<ActivityEntry> = {}
): ActivityEntry {
  return { timestamp: NOW - age, category, summary: `${category} activity`, ...opts };
}

function makeAgent(overrides: Partial<Agent> = {}, lastEntryAge = 0): Agent {
  return {
    id: "claude-code:abc",
    provider: "claude-code",
    pid: 1,
    cwd: "/x",
    status: "busy",
    startedAt: NOW - 600_000,
    currentAction: "executing",
    recentActivity: [entry("executing", lastEntryAge)],
    hostApp: null,
    subagents: [],
    ...overrides,
  };
}

describe("isLongRunningState", () => {
  it("is true for every working state held past the threshold", () => {
    const actions: NormalizedAction[] = [
      "thinking", "reading", "editing", "executing", "writing", "delegating", "other",
    ];
    for (const action of actions) {
      const agent = makeAgent({
        currentAction: action,
        recentActivity: [entry(action, 90_000)],
      });
      expect(isLongRunningState(agent, NOW, 60_000), action).toBe(true);
    }
  });

  it("is false while the state is still fresh", () => {
    expect(isLongRunningState(makeAgent({}, 10_000), NOW, 60_000)).toBe(false);
  });

  it("is false at exactly the threshold boundary", () => {
    expect(isLongRunningState(makeAgent({}, 60_000), NOW, 60_000)).toBe(false);
  });

  it("is false for waiting even when stale", () => {
    const agent = makeAgent({
      currentAction: "waiting",
      recentActivity: [entry("waiting", 90_000)],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is false for waiting status even when stale", () => {
    const agent = makeAgent(
      { status: "waiting", currentAction: "waiting" },
      90_000
    );
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is false for idle agents even when stale", () => {
    const agent = makeAgent(
      { status: "idle", currentAction: "idle" },
      90_000
    );
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is true when the same state spans many fresh entries with an old run start", () => {
    // Reading file after file for 3 minutes: each entry is fresh,
    // but the contiguous run of "reading" began long ago.
    const agent = makeAgent({
      currentAction: "reading",
      recentActivity: [
        entry("thinking", 200_000),
        entry("reading", 180_000),
        entry("reading", 90_000),
        entry("reading", 5_000),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(true);
  });

  it("is false when the state changed recently, even after a long prior state", () => {
    // Was executing for ages, switched to editing 10s ago.
    const agent = makeAgent({
      currentAction: "editing",
      recentActivity: [
        entry("executing", 300_000),
        entry("executing", 120_000),
        entry("editing", 10_000),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is false when the newest entry does not match the current action", () => {
    // currentAction derived from session status (shell → executing) while the
    // transcript's newest entry is something else. In practice this is a
    // BACKGROUND shell pinning the status between turns — the agent is
    // conversationally idle, so the mismatch age must not earn an hourglass.
    // (A genuine foreground command always matches: its tool_use entry is
    // written when the command starts.)
    const stale = makeAgent({
      currentAction: "executing",
      recentActivity: [entry("thinking", 90_000)],
    });
    expect(isLongRunningState(stale, NOW, 60_000)).toBe(false);

    const fresh = makeAgent({
      currentAction: "executing",
      recentActivity: [entry("thinking", 10_000)],
    });
    expect(isLongRunningState(fresh, NOW, 60_000)).toBe(false);
  });

  it("is false for the background-shell case: status busy, action executing, newest entry is the turn-final reply", () => {
    // Captured live: a session with background monitor shells keeps session
    // status "shell" between turns. The newest entry is the assistant's last
    // reply text, aging unboundedly while the agent waits for the user.
    const agent = makeAgent({
      currentAction: "executing",
      recentActivity: [
        entry("executing", 100_000),
        entry("thinking", 70_000),
        entry("writing", 62_000),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is false when there is no activity history", () => {
    expect(isLongRunningState(makeAgent({ recentActivity: [] }), NOW, 60_000)).toBe(false);
  });

  it("is false right after a new user prompt, even when the previous turn's entries are stale", () => {
    // The where-is-my-lego repro: the agent just went busy on a fresh prompt,
    // but the only other entries are from a turn that ended 10+ minutes ago.
    const agent = makeAgent({
      currentAction: "thinking",
      recentActivity: [
        entry("executing", 700_000),
        entry("writing", 690_000),
        entry("thinking", 5_000, { turnBoundary: true }),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("does not extend a run across a turn boundary even when categories match", () => {
    // Previous turn ended mid-thinking; the new prompt also maps to thinking.
    // The contiguous run must start at the boundary, not reach into the old turn.
    const agent = makeAgent({
      currentAction: "thinking",
      recentActivity: [
        entry("thinking", 400_000),
        entry("thinking", 390_000),
        entry("thinking", 5_000, { turnBoundary: true }),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(false);
  });

  it("is true when the agent has been in-state since an old turn boundary", () => {
    // Prompt arrived 90s ago and the model has streamed thinking ever since.
    const agent = makeAgent({
      currentAction: "thinking",
      recentActivity: [
        entry("thinking", 90_000, { turnBoundary: true }),
        entry("thinking", 40_000),
        entry("thinking", 5_000),
      ],
    });
    expect(isLongRunningState(agent, NOW, 60_000)).toBe(true);
  });

  it("defaults to the exported threshold", () => {
    const stale = makeAgent({}, LONG_RUNNING_THRESHOLD_MS + 1_000);
    expect(isLongRunningState(stale, NOW)).toBe(true);
  });
});
