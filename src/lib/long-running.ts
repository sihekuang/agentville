import type { Agent } from "./providers/types";

/** A tool call counts as "long-running" after this much time with no newer activity. */
export const LONG_RUNNING_THRESHOLD_MS = 60_000;

/**
 * True when a busy agent has been inside the same shell command (⚡ executing)
 * or tool call (🔧 other) for longer than `thresholdMs` — i.e. its newest
 * activity entry (the tool call itself) is older than the threshold and
 * nothing has been appended since. The scene uses this to add an ⏳ to the
 * agent's emote so a long build/tool run is visibly different from a quick one.
 */
export function isLongRunningTool(
  agent: Agent,
  now: number,
  thresholdMs: number = LONG_RUNNING_THRESHOLD_MS
): boolean {
  if (agent.status !== "busy") return false;
  if (agent.currentAction !== "executing" && agent.currentAction !== "other") return false;
  const last = agent.recentActivity[agent.recentActivity.length - 1];
  if (!last) return false;
  return now - last.timestamp > thresholdMs;
}
