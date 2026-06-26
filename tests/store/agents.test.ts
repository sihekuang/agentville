import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAgentStore, useHydratePersistedPipExpand } from "@/store/agents";
import type { Agent } from "@/lib/providers/types";
import { DEFAULT_IDLE_TIMEOUT_MS } from "@/lib/idle-detection";
import { PIP_EXPAND } from "@/lib/pip-resize";

const makeAgent = (overrides?: Partial<Agent>): Agent => ({
  id: "claude-code:abc-123",
  provider: "claude-code",
  pid: 12345,
  cwd: "/test",
  status: "busy",
  currentAction: "thinking",
  recentActivity: [],
  subagents: [],
  hostApp: null,
  startedAt: Date.now(),
  ...overrides,
});

describe("useAgentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      theme: "office",
    });
  });

  it("adds an agent", () => {
    const agent = makeAgent();

    useAgentStore.getState().addAgent(agent);
    expect(useAgentStore.getState().agents["claude-code:abc-123"]).toEqual(agent);
  });

  it("removes an agent", () => {
    const agent = makeAgent({ status: "idle", currentAction: "idle" });

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().removeAgent("claude-code:abc-123");
    expect(useAgentStore.getState().agents["claude-code:abc-123"]).toBeUndefined();
  });

  it("clears selection when selected agent is removed", () => {
    const agent = makeAgent({ status: "idle", currentAction: "idle" });

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().selectAgent("claude-code:abc-123");
    useAgentStore.getState().removeAgent("claude-code:abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("updates an agent", () => {
    const agent = makeAgent({ status: "idle", currentAction: "idle" });

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().updateAgent({ ...agent, status: "busy" });
    expect(useAgentStore.getState().agents["claude-code:abc-123"].status).toBe("busy");
  });

  it("selects and deselects an agent", () => {
    useAgentStore.getState().selectAgent("claude-code:abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBe("claude-code:abc-123");

    useAgentStore.getState().selectAgent(null);
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("changes the theme", () => {
    useAgentStore.getState().setTheme("farm");
    expect(useAgentStore.getState().theme).toBe("farm");
  });
});

describe("idleTimeoutMs store slice", () => {
  beforeEach(() => {
    localStorage.clear();
    useAgentStore.setState({ idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS });
  });

  it("defaults to DEFAULT_IDLE_TIMEOUT_MS", () => {
    expect(useAgentStore.getState().idleTimeoutMs).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });

  it("setIdleTimeoutMs updates state and persists to localStorage", () => {
    useAgentStore.getState().setIdleTimeoutMs(120_000);
    expect(useAgentStore.getState().idleTimeoutMs).toBe(120_000);
    expect(localStorage.getItem("agentville-idle-timeout")).toBe("120000");
  });

  it("setIdleTimeoutMs(0) represents Off", () => {
    useAgentStore.getState().setIdleTimeoutMs(0);
    expect(useAgentStore.getState().idleTimeoutMs).toBe(0);
    expect(localStorage.getItem("agentville-idle-timeout")).toBe("0");
  });
});

describe("PiP expand-trigger store slice", () => {
  beforeEach(() => {
    localStorage.clear();
    useAgentStore.setState({
      pipExpandTrigger: "off",
      pipExpandWidth: PIP_EXPAND.DEFAULT_WIDTH,
    });
  });

  it("defaults to 'off' with the default width", () => {
    expect(useAgentStore.getState().pipExpandTrigger).toBe("off");
    expect(useAgentStore.getState().pipExpandWidth).toBe(PIP_EXPAND.DEFAULT_WIDTH);
  });

  it("setPipExpandTrigger updates state and persists the mode string", () => {
    useAgentStore.getState().setPipExpandTrigger("click");
    expect(useAgentStore.getState().pipExpandTrigger).toBe("click");
    expect(localStorage.getItem("agentville-pip-expand-trigger")).toBe("click");

    useAgentStore.getState().setPipExpandTrigger("hover");
    expect(localStorage.getItem("agentville-pip-expand-trigger")).toBe("hover");
  });

  it("setPipExpandWidth clamps and persists", () => {
    useAgentStore.getState().setPipExpandWidth(1000);
    expect(useAgentStore.getState().pipExpandWidth).toBe(1000);
    expect(localStorage.getItem("agentville-pip-expand-width")).toBe("1000");

    useAgentStore.getState().setPipExpandWidth(99999);
    expect(useAgentStore.getState().pipExpandWidth).toBe(PIP_EXPAND.MAX_WIDTH);
  });

  it("syncs the trigger from a cross-window storage event", () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: "agentville-pip-expand-trigger", newValue: "click" }),
    );
    expect(useAgentStore.getState().pipExpandTrigger).toBe("click");

    window.dispatchEvent(
      new StorageEvent("storage", { key: "agentville-pip-expand-width", newValue: "600" }),
    );
    expect(useAgentStore.getState().pipExpandWidth).toBe(600);
  });

  it("ignores an invalid trigger from a storage event", () => {
    useAgentStore.getState().setPipExpandTrigger("hover");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "agentville-pip-expand-trigger", newValue: "bogus" }),
    );
    expect(useAgentStore.getState().pipExpandTrigger).toBe("hover");
  });

  it("migrates the legacy hover key on hydrate ('1' → 'hover') and writes the new key", () => {
    localStorage.setItem("agentville-pip-hover-expand", "1");
    renderHook(() => useHydratePersistedPipExpand());
    expect(useAgentStore.getState().pipExpandTrigger).toBe("hover");
    expect(localStorage.getItem("agentville-pip-expand-trigger")).toBe("hover");
  });

  it("migrates the legacy hover key '0' → 'off'", () => {
    localStorage.setItem("agentville-pip-hover-expand", "0");
    renderHook(() => useHydratePersistedPipExpand());
    expect(useAgentStore.getState().pipExpandTrigger).toBe("off");
  });

  it("prefers the new trigger key over the legacy key", () => {
    localStorage.setItem("agentville-pip-hover-expand", "1");
    localStorage.setItem("agentville-pip-expand-trigger", "click");
    renderHook(() => useHydratePersistedPipExpand());
    expect(useAgentStore.getState().pipExpandTrigger).toBe("click");
  });
});
