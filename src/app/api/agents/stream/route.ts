import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { discoverSessions, getTranscriptPath } from "@/lib/sessions";
import {
  parseTranscriptLine,
  currentActionFromTranscript,
} from "@/lib/transcript";
import { resolveHostApp } from "@/lib/host-app";
import type { AgentState, StreamEvent, TranscriptEntry } from "@/lib/types";

const CLAUDE_HOME = path.join(process.env.HOME ?? "~", ".claude");
const SESSIONS_DIR = path.join(CLAUDE_HOME, "sessions");
const PROJECTS_DIR = path.join(CLAUDE_HOME, "projects");
const POLL_INTERVAL = 2000;
const MAX_RECENT_ACTIONS = 20;

function buildAgentState(
  session: Awaited<ReturnType<typeof discoverSessions>>[number]
): AgentState {
  const transcriptPath = getTranscriptPath(
    PROJECTS_DIR,
    session.cwd,
    session.sessionId
  );

  let recentActions: TranscriptEntry[] = [];
  if (transcriptPath) {
    try {
      const raw = fs.readFileSync(transcriptPath, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      const allEntries: TranscriptEntry[] = [];
      for (const line of lines) {
        const entry = parseTranscriptLine(line);
        if (entry) allEntries.push(entry);
      }
      recentActions = allEntries.slice(-MAX_RECENT_ACTIONS);
    } catch {
      // transcript not available
    }
  }

  const hostApp = resolveHostApp(
    session.pid,
    session.cwd,
    session.sessionId
  );

  return {
    sessionId: session.sessionId,
    pid: session.pid,
    cwd: session.cwd,
    status: session.status,
    currentAction: currentActionFromTranscript(recentActions),
    lastToolName:
      recentActions.length > 0 &&
      recentActions[recentActions.length - 1].type === "tool_use"
        ? recentActions[recentActions.length - 1].summary.split(" ")[0]
        : null,
    subagents: [],
    hostApp,
    startedAt: session.startedAt,
    recentActions,
  };
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const knownAgents = new Map<string, AgentState>();

      const poll = async () => {
        if (cancelled) return;

        try {
          const sessions = await discoverSessions(SESSIONS_DIR);
          const currentIds = new Set(sessions.map((s) => s.sessionId));

          for (const session of sessions) {
            const agent = buildAgentState(session);
            const existing = knownAgents.get(session.sessionId);

            if (!existing) {
              knownAgents.set(session.sessionId, agent);
              const event: StreamEvent = {
                event: "agent-added",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            } else if (
              existing.status !== agent.status ||
              existing.currentAction !== agent.currentAction ||
              existing.recentActions.length !== agent.recentActions.length
            ) {
              knownAgents.set(session.sessionId, agent);
              const event: StreamEvent = {
                event: "agent-updated",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          }

          for (const [id, agent] of knownAgents) {
            if (!currentIds.has(id)) {
              knownAgents.delete(id);
              const event: StreamEvent = {
                event: "agent-removed",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          }
        } catch {
          // continue polling
        }

        if (!cancelled) {
          setTimeout(poll, POLL_INTERVAL);
        }
      };

      await poll();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
