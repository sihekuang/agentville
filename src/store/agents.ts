import { create } from "zustand";
import type { AgentState } from "@/lib/types";

export type Theme = "office" | "farm" | "workshop";
const VALID_THEMES: ReadonlySet<string> = new Set<Theme>(["office", "farm", "workshop"]);
const THEME_STORAGE_KEY = "agentville-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "office";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && VALID_THEMES.has(v)) return v as Theme;
  } catch {}
  return "office";
}

/** Extended agent state that includes provider information */
export interface TrackedAgent extends AgentState {
  /** Which provider this agent came from (e.g., "claude-code") */
  provider?: string;
}

interface AgentStore {
  agents: Record<string, TrackedAgent>;
  selectedAgentId: string | null;
  theme: Theme;

  addAgent: (agent: AgentState | TrackedAgent) => void;
  removeAgent: (sessionId: string) => void;
  updateAgent: (agent: AgentState | TrackedAgent) => void;
  selectAgent: (sessionId: string | null) => void;
  setTheme: (theme: Theme) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: readStoredTheme(),

  addAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.sessionId]: agent },
    })),

  removeAgent: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.agents;
      return {
        agents: rest,
        selectedAgentId:
          state.selectedAgentId === sessionId ? null : state.selectedAgentId,
      };
    }),

  updateAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.sessionId]: agent },
    })),

  selectAgent: (sessionId) => set({ selectedAgentId: sessionId }),

  setTheme: (theme) => {
    set({ theme });
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_STORAGE_KEY && e.newValue && VALID_THEMES.has(e.newValue)) {
      useAgentStore.setState({ theme: e.newValue as Theme });
    }
  });
}
