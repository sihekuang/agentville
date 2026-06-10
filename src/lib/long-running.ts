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
 * three minutes qualifies even though each individual read is fresh. When the
 * newest entry doesn't match `currentAction` (the action came from session
 * status rather than the transcript, e.g. shell → executing), fall back to
 * the newest entry's age.
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
  if (last.category === agent.currentAction) {
    for (let i = activity.length - 1; i >= 0 && activity[i].category === agent.currentAction; i--) {
      stateStart = activity[i].timestamp;
    }
  }
  return now - stateStart > thresholdMs;
}
