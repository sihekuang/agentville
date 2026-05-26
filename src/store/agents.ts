import { create } from "zustand";
import type { AgentState } from "@/lib/types";

export type Theme = "office" | "farm" | "workshop";

/** Extended agent state that includes provider information */
export interface TrackedAgent extends AgentState {
  /** Which provider this agent came from (e.g., "claude-code") */
  provider?: string;
}

interface AgentStore {
  agents: Record<string, TrackedAgent>;
  selectedAgentId: string | null;
  theme: Theme;
  pipActive: boolean;

  addAgent: (agent: AgentState | TrackedAgent) => void;
  removeAgent: (sessionId: string) => void;
  updateAgent: (agent: AgentState | TrackedAgent) => void;
  selectAgent: (sessionId: string | null) => void;
  setTheme: (theme: Theme) => void;
  setPipActive: (active: boolean) => void;
}

const _createStore = () =>
  create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",
  pipActive: false,

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

  setPipActive: (active) => set({ pipActive: active }),
}));

// Use a global singleton so re-imports (e.g. after vi.resetModules()) share state
declare global {
  // eslint-disable-next-line no-var
  var __agentStore: ReturnType<typeof _createStore> | undefined;
}

export const useAgentStore: ReturnType<typeof _createStore> =
  globalThis.__agentStore ?? (globalThis.__agentStore = _createStore());
