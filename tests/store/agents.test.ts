import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/store/agents";
import type { Agent } from "@/lib/providers/types";
import { DEFAULT_IDLE_TIMEOUT_MS } from "@/lib/idle-detection";

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
