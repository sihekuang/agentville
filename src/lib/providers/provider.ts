import type { DiscoveredAgent } from "./types";

export interface AgentProvider {
  /** Unique identifier for this provider (e.g., "claude-code") */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Discover all active agent sessions for this provider */
  discoverAgents(): Promise<DiscoveredAgent[]>;

  /** Check if this provider is available on the current system */
  isAvailable(): boolean;
}
