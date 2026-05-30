import fs from "fs";
import type { AgentProvider } from "./provider";
import type { Agent, NormalizedAction, ActivityEntry } from "./types";
import { makeAgentId } from "./types";
import { resolveHostApp } from "../host-app";
import {
  discoverCodexProcesses,
  defaultScan,
  type CodexProcess,
  type CodexProcessScan,
} from "../codex/discovery";
import {
  parseCodexRollout,
  normalizeCodexAction,
  type CodexEntry,
} from "../codex/rollout";

const MAX_RECENT_ACTIONS = 20;
const BUSY_WINDOW_MS = 10_000;
// Codex sessions must NOT match against Claude's IDE locks at ~/.claude/ide.
// Force the process-tree fallback by pointing at a path that won't exist.
const CODEX_IDE_DIR = "/tmp/__codex_no_ide_locks__";

export interface CodexProviderOptions {
  /** Injectable for tests; defaults to live `pgrep+lsof`. */
  scan?: CodexProcessScan;
  /** Injectable clock; defaults to `Date.now`. */
  now?: () => number;
}

export class CodexProvider implements AgentProvider {
  readonly name = "codex";
  readonly displayName = "Codex";

  private readonly scan: CodexProcessScan;
  private readonly now: () => number;

  constructor(opts: CodexProviderOptions = {}) {
    this.scan = opts.scan ?? defaultScan;
    this.now = opts.now ?? Date.now;
  }

  isAvailable(): boolean {
    // Discovery itself is the truth; return true and let discoverAgents() decide.
    return true;
  }

  async discoverAgents(): Promise<Agent[]> {
    const processes = await discoverCodexProcesses(this.scan);
    const out: Agent[] = [];
    for (const proc of processes) {
      const agent = this.buildAgent(proc);
      if (agent) out.push(agent);
    }
    return out;
  }

  private buildAgent(p: CodexProcess): Agent | null {
    let raw = "";
    let mtimeMs = this.now();
    try {
      raw = fs.readFileSync(p.rolloutPath, "utf-8");
      mtimeMs = fs.statSync(p.rolloutPath).mtimeMs;
    } catch {
      return null;
    }

    const entries: CodexEntry[] = parseCodexRollout(raw);
    const recent = entries.slice(-MAX_RECENT_ACTIONS);

    const currentAction: NormalizedAction = recent.length > 0
      ? normalizeCodexAction(recent[recent.length - 1])
      : "idle";

    const status: Agent["status"] =
      this.now() - mtimeMs < BUSY_WINDOW_MS ? "busy" : "idle";

    const recentActivity: ActivityEntry[] = recent.map((e) => ({
      timestamp: e.timestamp,
      category: normalizeCodexAction(e),
      summary: e.summary,
      rawType: e.kind,
      rawToolName: e.kind === "function_call" ? e.name : undefined,
    }));

    const hostApp = resolveHostApp(p.pid, p.cwd, p.sessionId, CODEX_IDE_DIR);

    return {
      id: makeAgentId(this.name, p.sessionId),
      provider: this.name,
      pid: p.pid,
      cwd: p.cwd,
      status,
      startedAt: mtimeMs,
      currentAction,
      recentActivity,
      hostApp,
      subagents: [],
      metadata: { rolloutPath: p.rolloutPath },
    };
  }
}
