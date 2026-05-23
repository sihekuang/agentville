"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import type { StreamEvent } from "@/lib/types";

export function useAgentStream() {
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      while (!cancelled) {
        try {
          const controller = new AbortController();
          abortRef.current = controller;

          const response = await fetch("/api/agents/stream", {
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
                    removeAgent(event.agent.sessionId);
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
        } catch (err) {
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
  }, [addAgent, removeAgent, updateAgent]);
}
