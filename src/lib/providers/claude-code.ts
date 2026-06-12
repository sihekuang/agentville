import fs from "fs";
import os from "os";
import path from "path";
import type { AgentProvider } from "./provider";
import type { Agent, NormalizedAction, ActivityEntry } from "./types";
import { makeAgentId } from "./types";
import type { TranscriptEntry } from "../transcript";
import { discoverSessions, getTranscriptPath, getSessionDir, escapeCwd } from "../sessions";
import {
  parseTranscriptLine,
  currentActionFromTranscript,
  actionForClaudeTool,
  toolNameOf,
} from "../transcript";
import { newestMtime } from "../activity-mtime";
import { resolveHostApp } from "../host-app";

const MAX_RECENT_ACTIONS = 20;

/** Map a Claude TranscriptEntry to a provider-agnostic ActivityEntry */
export function toActivityEntry(entry: TranscriptEntry): ActivityEntry {
  const rawToolName = entry.type === "tool_use" ? toolNameOf(entry) : undefined;

  let category: NormalizedAction;
  switch (entry.type) {
    case "thinking":
      category = "thinking";
      break;
    case "text":
      category = "writing";
      break;
    case "tool_use":
      category = actionForClaudeTool(rawToolName ?? "");
      break;
    case "subagent_start":
    case "subagent_stop":
      category = "delegating";
      break;
    case "user_prompt":
      category = "thinking";
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
    ...(entry.type === "user_prompt" ? { turnBoundary: true } : {}),
  };
}

/**
 * Resolve `currentAction` for a Claude session whose status is "shell" (a
 * process is live). If the newest transcript entry is itself a shell command
 * the agent is running it in the foreground → "shell". If the newest entry is
 * anything else, the turn has moved on and a BACKGROUND shell is keeping the
 * status pinned → "monitoring". No transcript → assume a foreground command.
 */
export function actionForShellStatus(entries: TranscriptEntry[]): NormalizedAction {
  const last = entries[entries.length - 1];
  if (last && toActivityEntry(last).category !== "shell") return "monitoring";
  return "shell";
}

export interface ClaudeCodeProviderOptions {
  /**
   * Base dir for background-task output files
   * (`<tasksBaseDir>/<escaped-cwd>/<sessionId>/tasks/*.output`).
   * Claude Code streams background task output there continuously, so the
   * files' mtimes are a live activity signal. Injectable for tests.
   */
  tasksBaseDir?: string;
}

function defaultTasksBaseDir(): string {
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  return `/tmp/claude-${uid}`;
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly name = "claude-code";
  readonly displayName = "Claude Code";

  private readonly claudeHome: string;
  private readonly sessionsDir: string;
  private readonly projectsDir: string;
  private readonly tasksBaseDir: string;

  constructor(claudeHome?: string, opts: ClaudeCodeProviderOptions = {}) {
    const home = process.env.HOME || os.homedir();
    this.claudeHome = claudeHome ?? path.join(home, ".claude");
    this.sessionsDir = path.join(this.claudeHome, "sessions");
    this.projectsDir = path.join(this.claudeHome, "projects");
    this.tasksBaseDir = opts.tasksBaseDir ?? defaultTasksBaseDir();
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

    // Activity signal = freshest mtime across the transcript, the session's
    // subagent/tool-result files, and background-task output files. These are
    // written as work happens, so this is much fresher than parsing per-turn
    // token-usage timestamps. A "shell" session status is authoritative —
    // Claude Code asserts a command is executing right now — so it counts as
    // current activity regardless of file mtimes (a long build writes nothing
    // until it finishes).
    const sessionDir = getSessionDir(this.projectsDir, session.cwd, session.sessionId);
    const transcriptFile = path.join(
      this.projectsDir,
      escapeCwd(session.cwd),
      `${session.sessionId}.jsonl`
    );
    const lastTokenActivityAt =
      session.status === "shell"
        ? Date.now()
        : newestMtime([
            transcriptFile,
            path.join(sessionDir, "subagents"),
            path.join(sessionDir, "tool-results"),
            path.join(this.tasksBaseDir, escapeCwd(session.cwd), session.sessionId, "tasks"),
          ]);

    const currentAction: NormalizedAction =
      session.status === "shell"
        ? actionForShellStatus(recentTranscript)
        : session.status === "waiting"
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
      // Collapse session statuses to the Agent vocabulary: anything that isn't
      // "idle" is "busy" (the scene paints non-idle as working). The richer
      // session statuses survive in currentAction — "waiting" → ❓ and
      // "shell" → ⚡ executing.
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
