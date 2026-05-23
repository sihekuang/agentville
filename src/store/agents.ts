import { create } from "zustand";
import type { AgentState } from "@/lib/types";

export type Theme = "office" | "farm" | "workshop";

interface AgentStore {
  agents: Record<string, AgentState>;
  selectedAgentId: string | null;
  theme: Theme;

  addAgent: (agent: AgentState) => void;
  removeAgent: (sessionId: string) => void;
  updateAgent: (agent: AgentState) => void;
  selectAgent: (sessionId: string | null) => void;
  setTheme: (theme: Theme) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",

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

  setTheme: (theme) => set({ theme }),
}));
