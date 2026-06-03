"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import type { StreamEvent } from "@/app/api/agents/stream/route";

export function useAgentStream() {
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const idleTimeoutMs = useAgentStore((s) => s.idleTimeoutMs);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      while (!cancelled) {
        try {
          const controller = new AbortController();
          abortRef.current = controller;

          const url = `/api/agents/stream?idleTimeoutMs=${idleTimeoutMs === 0 ? "off" : idleTimeoutMs}`;
          const response = await fetch(url, {
            signal: controller.signal,
          });

          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.trim().length === 0) continue;
              try {
                const event: StreamEvent = JSON.parse(line);
                switch (event.event) {
                  case "agent-added":
                    addAgent(event.agent);
                    break;
                  case "agent-removed":
                    removeAgent(event.agent.id);
                    break;
                  case "agent-updated":
                    updateAgent(event.agent);
                    break;
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        } catch {
          if (cancelled) return;
        }

        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [addAgent, removeAgent, updateAgent, idleTimeoutMs]);
}
