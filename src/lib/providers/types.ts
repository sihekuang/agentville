import type { HostApp } from "../types";

/** Provider-agnostic agent action categories */
export type NormalizedAction =
  | "thinking"
  | "reading"
  | "editing"
  | "executing"
  | "writing"
  | "delegating"
  | "other"
  | "waiting"
  | "idle";

/** A single activity entry from an agent's transcript/log */
export interface ActivityEntry {
  timestamp: number;
  category: NormalizedAction;
  summary: string;
  /** Original type from the provider (e.g., "tool_use", "thinking") */
  rawType?: string;
  /** Original tool name if applicable (e.g., "Read", "bash") */
  rawToolName?: string;
}

/** A discovered agent session, provider-agnostic */
export interface DiscoveredAgent {
  id: string;
  provider: string;
  pid: number;
  cwd: string;
  status: "busy" | "idle" | "waiting";
  startedAt: number;
  currentAction: NormalizedAction;
  recentActivity: ActivityEntry[];
  hostApp: HostApp | null;
  subagents: DiscoveredAgent[];
  /** Provider-specific extras (e.g., version, entrypoint for Claude Code) */
  metadata?: Record<string, unknown>;
}

export type { HostApp } from "../types";

/**
 * Build a uniform Agent id: `<provider>:<sessionId>`.
 * Provider must be non-empty and contain no colons.
 * sessionId must be non-empty (may contain colons; we split on the first).
 */
export function makeAgentId(provider: string, sessionId: string): string {
  if (!provider) throw new Error("makeAgentId: provider must be non-empty");
  if (!sessionId) throw new Error("makeAgentId: sessionId must be non-empty");
  if (provider.includes(":")) {
    throw new Error(`makeAgentId: provider must not contain ':' (got "${provider}")`);
  }
  return `${provider}:${sessionId}`;
}

/**
 * Split a uniform Agent id back into its parts.
 * Splits on the FIRST colon so a sessionId may itself contain colons.
 * Returns null if the id is malformed (missing colon, empty provider, or empty sessionId).
 */
export function parseAgentId(id: string): { provider: string; sessionId: string } | null {
  const i = id.indexOf(":");
  if (i <= 0) return null;
  const sessionId = id.slice(i + 1);
  if (!sessionId) return null;
  return { provider: id.slice(0, i), sessionId };
}
