import type { Agent } from "./providers/types";

/**
 * Default window with no file activity before an agent is marked "stalled".
 * Conservative because the signal (transcript/rollout file mtime) still lags
 * during an in-progress turn — see activity-mtime.ts.
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

const MIN_IDLE_TIMEOUT_MS = 5_000;
const MAX_IDLE_TIMEOUT_MS = 3_600_000;

/**
 * Parse the `?idleTimeoutMs` query value into a timeout in ms.
 * - "off"             → Infinity (the override never fires)
 * - a finite number   → clamped to [MIN_IDLE_TIMEOUT_MS, MAX_IDLE_TIMEOUT_MS]
 * - missing / garbage → DEFAULT_IDLE_TIMEOUT_MS
 */
export function parseIdleTimeoutParam(raw: string | null): number {
  if (raw === null) return DEFAULT_IDLE_TIMEOUT_MS;
  if (raw === "off") return Number.POSITIVE_INFINITY;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(MAX_IDLE_TIMEOUT_MS, Math.max(MIN_IDLE_TIMEOUT_MS, n));
}

/**
 * Force a provider-"busy" agent to "stalled" when there has been no file
 * activity (`lastTokenActivityAt`) for `timeoutMs`. Pure: returns the SAME
 * agent reference when nothing changes, or a new object when overridden.
 *
 * - Only "busy" agents are affected (normal idle/waiting are left alone).
 * - A "waiting for input" agent (currentAction === "waiting") is preserved.
 * - If the activity signal is unknown, the agent is left untouched (fail-safe).
 */
export function applyIdleOverride(agent: Agent, now: number, timeoutMs: number): Agent {
  if (agent.status !== "busy") return agent;
  if (agent.currentAction === "waiting") return agent;
  if (agent.lastTokenActivityAt === undefined) return agent;
  if (now - agent.lastTokenActivityAt <= timeoutMs) return agent;
  return { ...agent, status: "stalled", currentAction: "idle" };
}
