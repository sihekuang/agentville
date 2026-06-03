import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers";
import type { Agent } from "@/lib/providers/types";
import { applyIdleOverride, parseIdleTimeoutParam } from "@/lib/idle-detection";

const POLL_INTERVAL = 2000;

export interface StreamEvent {
  event: "agent-added" | "agent-removed" | "agent-updated";
  agent: Agent;
}

export async function GET(req: Request): Promise<Response> {
  const timeoutMs = parseIdleTimeoutParam(new URL(req.url).searchParams.get("idleTimeoutMs"));
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const known = new Map<string, Agent>();
      const registry = getRegistry();

      const poll = async () => {
        if (cancelled) return;
        try {
          const discovered = (await registry.discoverAll()).map((a) =>
            applyIdleOverride(a, Date.now(), timeoutMs),
          );
          const currentIds = new Set(discovered.map((a) => a.id));

          for (const agent of discovered) {
            const existing = known.get(agent.id);
            if (!existing) {
              known.set(agent.id, agent);
              const ev: StreamEvent = { event: "agent-added", agent };
              controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
            } else if (
              existing.status !== agent.status ||
              existing.currentAction !== agent.currentAction ||
              existing.recentActivity.length !== agent.recentActivity.length
            ) {
              known.set(agent.id, agent);
              const ev: StreamEvent = { event: "agent-updated", agent };
              controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
            }
          }
          for (const [id, agent] of known) {
            if (!currentIds.has(id)) {
              known.delete(id);
              const ev: StreamEvent = { event: "agent-removed", agent };
              controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
            }
          }
        } catch (err) {
          console.error("[agentville] discovery poll error:", (err as Error).message);
        }
        if (!cancelled) setTimeout(poll, POLL_INTERVAL);
      };

      await poll();
    },
    cancel() { cancelled = true; },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
