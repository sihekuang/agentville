import type { Agent } from "./providers/types";

/** A state counts as "long-running" after this much continuous time in it. */
export const LONG_RUNNING_THRESHOLD_MS = 60_000;

/**
 * True when a busy agent has been in the same state (💭 thinking, 📖 reading,
 * ✏️ editing, ⚡ executing, …) continuously for longer than `thresholdMs`.
 * The scene uses this to add an ⏳ to the agent's emote so a long stretch of
 * one activity is visibly different from a quick one.
 *
 * Excluded by design: idle (sleeping agents) and ❓ waiting (the user's turn,
 * not the agent running long).
 *
 * "Time in state" is the start of the contiguous run of `recentActivity`
 * entries matching `currentAction` — an agent reading file after file for
 * three minutes qualifies even though each individual read is fresh. A run
 * never extends across a turn boundary (a user prompt): a new prompt resets
 * the clock even when the categories on both sides happen to match. When the
 * newest entry doesn't match `currentAction`, time in state is unknowable, so
 * never long-running: the only real-world mismatch is a status-derived action
 * (shell → executing) from a BACKGROUND shell pinning the session status
 * between turns — the newest entry is then the turn-final reply, aging
 * unboundedly while the agent just waits for the user. A genuine foreground
 * command always matches, because its tool_use entry is written at start.
 */
export function isLongRunningState(
  agent: Agent,
  now: number,
  thresholdMs: number = LONG_RUNNING_THRESHOLD_MS
): boolean {
  if (agent.status !== "busy") return false;
  if (agent.currentAction === "idle" || agent.currentAction === "waiting") return false;
  const activity = agent.recentActivity;
  const last = activity[activity.length - 1];
  if (!last) return false;

  if (last.category !== agent.currentAction) return false;

  let stateStart = last.timestamp;
  for (let i = activity.length - 1; i >= 0 && activity[i].category === agent.currentAction; i--) {
    stateStart = activity[i].timestamp;
    if (activity[i].turnBoundary) break;
  }
  return now - stateStart > thresholdMs;
}
