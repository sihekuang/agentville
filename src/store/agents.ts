import { create } from "zustand";
import { useEffect } from "react";
import type { Agent } from "@/lib/providers/types";
import { DEFAULT_IDLE_TIMEOUT_MS } from "@/lib/idle-detection";
import { clampExpandWidth, PIP_EXPAND } from "@/lib/pip-resize";

export type Theme = "office" | "farm" | "workshop";
const VALID_THEMES: ReadonlySet<string> = new Set<Theme>(["office", "farm", "workshop"]);

export type PipExpandTrigger = "off" | "hover" | "click";
const VALID_PIP_TRIGGERS: ReadonlySet<string> = new Set<PipExpandTrigger>(["off", "hover", "click"]);
const THEME_STORAGE_KEY = "agentville-theme";
const IDLE_TIMEOUT_STORAGE_KEY = "agentville-idle-timeout";
const PIP_EXPAND_TRIGGER_STORAGE_KEY = "agentville-pip-expand-trigger";
const PIP_HOVER_EXPAND_STORAGE_KEY = "agentville-pip-hover-expand"; // legacy: read once at hydrate for migration
const PIP_EXPAND_WIDTH_STORAGE_KEY = "agentville-pip-expand-width";

/** Alias kept for callers; identical shape to Agent */
export type TrackedAgent = Agent;

interface AgentStore {
  agents: Record<string, TrackedAgent>;
  selectedAgentId: string | null;
  theme: Theme;
  idleTimeoutMs: number;
  pipExpandTrigger: PipExpandTrigger;
  pipExpandWidth: number;

  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (agent: Agent) => void;
  selectAgent: (id: string | null) => void;
  setTheme: (theme: Theme) => void;
  setIdleTimeoutMs: (ms: number) => void;
  setPipExpandTrigger: (mode: PipExpandTrigger) => void;
  setPipExpandWidth: (width: number) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  pipExpandTrigger: "off",
  pipExpandWidth: PIP_EXPAND.DEFAULT_WIDTH,

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

  setIdleTimeoutMs: (ms) => {
    set({ idleTimeoutMs: ms });
    try { localStorage.setItem(IDLE_TIMEOUT_STORAGE_KEY, String(ms)); } catch {}
  },

  setPipExpandTrigger: (mode) => {
    set({ pipExpandTrigger: mode });
    try { localStorage.setItem(PIP_EXPAND_TRIGGER_STORAGE_KEY, mode); } catch {}
  },

  setPipExpandWidth: (width) => {
    const w = clampExpandWidth(width);
    set({ pipExpandWidth: w });
    try { localStorage.setItem(PIP_EXPAND_WIDTH_STORAGE_KEY, String(w)); } catch {}
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

/** Rehydrate the idle timeout from localStorage after mount (avoids SSR mismatch). */
export function useHydratePersistedIdleTimeout(): void {
  useEffect(() => {
    try {
      const v = localStorage.getItem(IDLE_TIMEOUT_STORAGE_KEY);
      if (v !== null) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) {
          useAgentStore.setState({ idleTimeoutMs: n });
        }
      }
    } catch {}
  }, []);
}

/** Rehydrate PiP expand settings from localStorage after mount (with legacy key migration). */
export function useHydratePersistedPipExpand(): void {
  useEffect(() => {
    try {
      const trigger = localStorage.getItem(PIP_EXPAND_TRIGGER_STORAGE_KEY);
      if (trigger !== null && VALID_PIP_TRIGGERS.has(trigger)) {
        useAgentStore.setState({ pipExpandTrigger: trigger as PipExpandTrigger });
      } else {
        // Migrate the legacy boolean key, then write the new key so it stops mattering.
        const legacy = localStorage.getItem(PIP_HOVER_EXPAND_STORAGE_KEY);
        if (legacy !== null) {
          const migrated: PipExpandTrigger = legacy === "1" ? "hover" : "off";
          useAgentStore.setState({ pipExpandTrigger: migrated });
          try { localStorage.setItem(PIP_EXPAND_TRIGGER_STORAGE_KEY, migrated); } catch {}
        }
      }
      const width = localStorage.getItem(PIP_EXPAND_WIDTH_STORAGE_KEY);
      if (width !== null) {
        const n = Number(width);
        if (Number.isFinite(n)) {
          useAgentStore.setState({ pipExpandWidth: clampExpandWidth(n) });
        }
      }
    } catch {}
  }, []);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_STORAGE_KEY && e.newValue && VALID_THEMES.has(e.newValue)) {
      useAgentStore.setState({ theme: e.newValue as Theme });
    }
    if (e.key === IDLE_TIMEOUT_STORAGE_KEY && e.newValue !== null) {
      const n = Number(e.newValue);
      if (Number.isFinite(n) && n >= 0) {
        useAgentStore.setState({ idleTimeoutMs: n });
      }
    }
    if (
      e.key === PIP_EXPAND_TRIGGER_STORAGE_KEY &&
      e.newValue !== null &&
      VALID_PIP_TRIGGERS.has(e.newValue)
    ) {
      useAgentStore.setState({ pipExpandTrigger: e.newValue as PipExpandTrigger });
    }
    if (e.key === PIP_EXPAND_WIDTH_STORAGE_KEY && e.newValue !== null) {
      const n = Number(e.newValue);
      if (Number.isFinite(n)) {
        useAgentStore.setState({ pipExpandWidth: clampExpandWidth(n) });
      }
    }
  });
}
