import { create } from "zustand";
import { useEffect } from "react";
import type { Agent } from "@/lib/providers/types";

export type Theme = "office" | "farm" | "workshop";
const VALID_THEMES: ReadonlySet<string> = new Set<Theme>(["office", "farm", "workshop"]);
const THEME_STORAGE_KEY = "agentville-theme";

/** Alias kept for callers; identical shape to Agent */
export type TrackedAgent = Agent;

interface AgentStore {
  agents: Record<string, TrackedAgent>;
  selectedAgentId: string | null;
  theme: Theme;

  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (agent: Agent) => void;
  selectAgent: (id: string | null) => void;
  setTheme: (theme: Theme) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",

  addAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.id]: agent },
    })),

  removeAgent: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.agents;
      return {
        agents: rest,
        selectedAgentId:
          state.selectedAgentId === id ? null : state.selectedAgentId,
      };
    }),

  updateAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.id]: agent },
    })),

  selectAgent: (id) => set({ selectedAgentId: id }),

  setTheme: (theme) => {
    set({ theme });
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  },
}));

/**
 * Call this hook once from a top-level client component (e.g. Providers).
 * It hydrates the theme from localStorage after mount, avoiding an SSR mismatch
 * that occurs when the store's initial state always returns "office" on the server.
 */
export function useHydratePersistedTheme(): void {
  useEffect(() => {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v && VALID_THEMES.has(v)) {
        useAgentStore.setState({ theme: v as Theme });
      }
    } catch {}
  }, []);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_STORAGE_KEY && e.newValue && VALID_THEMES.has(e.newValue)) {
      useAgentStore.setState({ theme: e.newValue as Theme });
    }
  });
}
