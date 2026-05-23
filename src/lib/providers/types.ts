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
  status: "busy" | "idle";
  startedAt: number;
  currentAction: NormalizedAction;
  recentActivity: ActivityEntry[];
  hostApp: HostApp | null;
  subagents: DiscoveredAgent[];
  /** Provider-specific extras (e.g., version, entrypoint for Claude Code) */
  metadata?: Record<string, unknown>;
}

export type { HostApp } from "../types";
