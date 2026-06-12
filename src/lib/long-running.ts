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
 * newest entry's category doesn't match `currentAction` (a
 * status-derived action such as a live shell rendered as `shell`/`monitoring`,
 * while the newest transcript entry is the turn-final reply), the contiguous
 * run is empty and time-in-state falls back to the newest entry's age — so a
 * long-lived background process earns an ⏳ rather than being suppressed.
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

  let stateStart = last.timestamp;
  for (let i = activity.length - 1; i >= 0 && activity[i].category === agent.currentAction; i--) {
    stateStart = activity[i].timestamp;
    if (activity[i].turnBoundary) break;
  }
  return now - stateStart > thresholdMs;
}
