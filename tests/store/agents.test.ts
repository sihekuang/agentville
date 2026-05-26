import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/store/agents";

describe("useAgentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      theme: "office",
    });
  });

  it("adds an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "busy" as const,
      currentAction: "thinking" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    expect(useAgentStore.getState().agents["abc-123"]).toEqual(agent);
  });

  it("removes an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().removeAgent("abc-123");
    expect(useAgentStore.getState().agents["abc-123"]).toBeUndefined();
  });

  it("clears selection when selected agent is removed", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().selectAgent("abc-123");
    useAgentStore.getState().removeAgent("abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("updates an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().updateAgent({ ...agent, status: "busy" });
    expect(useAgentStore.getState().agents["abc-123"].status).toBe("busy");
  });

  it("selects and deselects an agent", () => {
    useAgentStore.getState().selectAgent("abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBe("abc-123");

    useAgentStore.getState().selectAgent(null);
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("changes the theme", () => {
    useAgentStore.getState().setTheme("farm");
    expect(useAgentStore.getState().theme).toBe("farm");
  });
});
