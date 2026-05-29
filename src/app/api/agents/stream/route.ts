import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers";
import type { Agent } from "@/lib/providers";
import type { AgentState, AgentAction, StreamEvent, TranscriptEntry } from "@/lib/types";

const POLL_INTERVAL = 2000;

/** Map a NormalizedAction back to the legacy AgentAction type for the frontend */
function toLegacyAction(
  agent: Agent
): { currentAction: AgentAction; lastToolName: string | null } {
  const recent = agent.recentActivity;
  const lastEntry = recent.length > 0 ? recent[recent.length - 1] : null;

  // Derive lastToolName from the last activity entry if it was a tool use
  const lastToolName =
    lastEntry?.rawType === "tool_use" ? (lastEntry.rawToolName ?? null) : null;

  // Map NormalizedAction back to Claude-specific AgentAction
  let currentAction: AgentAction;
  switch (agent.currentAction) {
    case "reading":
      currentAction = "tool:Read";
      break;
    case "editing":
      // Check the raw tool name to distinguish Edit vs Write
      currentAction =
        lastToolName === "Write" ? "tool:Write" : "tool:Edit";
      break;
    case "executing":
      currentAction = "tool:Bash";
      break;
    case "delegating":
      currentAction = "tool:Agent";
      break;
    case "other":
      currentAction = "tool:other";
      break;
    case "thinking":
      currentAction = "thinking";
      break;
    case "writing":
      currentAction = "writing";
      break;
    case "waiting":
      currentAction = "waiting";
      break;
    case "idle":
    default:
      currentAction = "idle";
      break;
  }

  return { currentAction, lastToolName };
}

/** Bridge a provider-agnostic Agent to the legacy AgentState for the frontend */
function toAgentState(agent: Agent): AgentState {
  const { currentAction, lastToolName } = toLegacyAction(agent);

  const recentActions: TranscriptEntry[] = agent.recentActivity.map(
    (entry) => ({
      timestamp: entry.timestamp,
      type: (entry.rawType ?? entry.category) as TranscriptEntry["type"],
      summary: entry.summary,
    })
  );

  return {
    sessionId: agent.id,
    pid: agent.pid,
    cwd: agent.cwd,
    status: agent.status === "waiting" ? "busy" : agent.status,
    currentAction,
    lastToolName,
    subagents: agent.subagents.map(toAgentState),
    hostApp: agent.hostApp,
    startedAt: agent.startedAt,
    recentActions,
  };
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const knownAgents = new Map<string, AgentState>();

      const registry = getRegistry();

      const poll = async () => {
        if (cancelled) return;

        try {
          const discovered = await registry.discoverAll();
          const currentIds = new Set(discovered.map((a) => a.id));

          for (const discoveredAgent of discovered) {
            const agent = toAgentState(discoveredAgent);
            const existing = knownAgents.get(discoveredAgent.id);

            if (!existing) {
              knownAgents.set(discoveredAgent.id, agent);
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
              knownAgents.set(discoveredAgent.id, agent);
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
        } catch (err) {
          console.error("[agentville] discovery poll error:", (err as Error).message);
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
