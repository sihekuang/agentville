import fs from "fs";
import os from "os";
import path from "path";
import type { AgentProvider } from "./provider";
import type { Agent, NormalizedAction, ActivityEntry } from "./types";
import { makeAgentId } from "./types";
import type { TranscriptEntry } from "../transcript";
import { discoverSessions, getTranscriptPath, getSessionDir, escapeCwd } from "../sessions";
import { parseTranscriptLine, currentActionFromTranscript } from "../transcript";
import { newestMtime } from "../activity-mtime";
import { resolveHostApp } from "../host-app";

const MAX_RECENT_ACTIONS = 20;

/** Map a Claude TranscriptEntry to a provider-agnostic ActivityEntry */
export function toActivityEntry(entry: TranscriptEntry): ActivityEntry {
  const rawToolName =
    entry.type === "tool_use"
      ? entry.summary.split(" ")[0].split(":")[0]
      : undefined;

  let category: NormalizedAction;
  switch (entry.type) {
    case "thinking":
      category = "thinking";
      break;
    case "text":
      category = "writing";
      break;
    case "tool_use": {
      const toolName = rawToolName ?? "";
      if (toolName === "Read") category = "reading";
      else if (toolName === "Edit" || toolName === "Write") category = "editing";
      else if (toolName === "Bash") category = "executing";
      else if (toolName === "Agent") category = "delegating";
      else category = "other";
      break;
    }
    case "subagent_start":
    case "subagent_stop":
      category = "delegating";
      break;
    default:
      category = "other";
  }

  return {
    timestamp: entry.timestamp,
    category,
    summary: entry.summary,
    rawType: entry.type,
    rawToolName,
  };
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly name = "claude-code";
  readonly displayName = "Claude Code";

  private readonly claudeHome: string;
  private readonly sessionsDir: string;
  private readonly projectsDir: string;

  constructor(claudeHome?: string) {
    const home = process.env.HOME || os.homedir();
    this.claudeHome = claudeHome ?? path.join(home, ".claude");
    this.sessionsDir = path.join(this.claudeHome, "sessions");
    this.projectsDir = path.join(this.claudeHome, "projects");
  }

  isAvailable(): boolean {
    try {
      return fs.existsSync(this.sessionsDir);
    } catch {
      return false;
    }
  }

  async discoverAgents(): Promise<Agent[]> {
    const sessions = await discoverSessions(this.sessionsDir);
    return sessions.map((session) => this.buildAgent(session));
  }

  private buildAgent(
    session: Awaited<ReturnType<typeof discoverSessions>>[number]
  ): Agent {
    const transcriptPath = getTranscriptPath(
      this.projectsDir,
      session.cwd,
      session.sessionId
    );

    let recentTranscript: TranscriptEntry[] = [];
    if (transcriptPath) {
      try {
        const raw = fs.readFileSync(transcriptPath, "utf-8");
        const lines = raw.split("\n").filter((l) => l.trim().length > 0);
        const allEntries: TranscriptEntry[] = [];
        for (const line of lines) {
          const entry = parseTranscriptLine(line);
          if (entry) allEntries.push(entry);
        }
        recentTranscript = allEntries.slice(-MAX_RECENT_ACTIONS);
      } catch (err) {
        console.warn(`[agentville] failed to read transcript for ${session.sessionId.slice(0, 8)}:`, (err as Error).message);
      }
    }

    // Activity signal = freshest mtime across the transcript and the session's
    // subagent/tool-result files. These are written as work happens, so this is
    // much fresher than parsing per-turn token-usage timestamps.
    const sessionDir = getSessionDir(this.projectsDir, session.cwd, session.sessionId);
    const transcriptFile = path.join(
      this.projectsDir,
      escapeCwd(session.cwd),
      `${session.sessionId}.jsonl`
    );
    const lastTokenActivityAt = newestMtime([
      transcriptFile,
      path.join(sessionDir, "subagents"),
      path.join(sessionDir, "tool-results"),
    ]);

    const currentAction: NormalizedAction =
      session.status === "waiting"
        ? "waiting"
        : session.status === "idle"
          ? "idle"
          : currentActionFromTranscript(recentTranscript);

    const hostApp = resolveHostApp(
      session.pid,
      session.cwd,
      session.sessionId
    );

    return {
      id: makeAgentId(this.name, session.sessionId),
      provider: this.name,
      pid: session.pid,
      cwd: session.cwd,
      // Claude Code can report non-canonical statuses (e.g. "shell") that aren't
      // in the Agent vocabulary. Collapse anything that isn't "idle" to the
      // canonical "busy" so downstream consumers agree: the idle override (which
      // only acts on "busy") and the scene (which paints non-idle as working).
      // "waiting" → "busy" keeps the active look; currentAction preserves "waiting".
      status: session.status === "idle" ? "idle" : "busy",
      startedAt: session.startedAt,
      currentAction,
      recentActivity: recentTranscript.map(toActivityEntry),
      lastTokenActivityAt,
      hostApp,
      subagents: [],
      metadata: {
        version: session.version,
        entrypoint: session.entrypoint,
      },
    };
  }
}
