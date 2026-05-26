import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/store/agents";

describe("pipActive state", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      theme: "office",
      pipActive: false,
    });
  });

  it("defaults to false", () => {
    expect(useAgentStore.getState().pipActive).toBe(false);
  });

  it("setPipActive(true) activates PIP", () => {
    useAgentStore.getState().setPipActive(true);
    expect(useAgentStore.getState().pipActive).toBe(true);
  });

  it("setPipActive(false) deactivates PIP", () => {
    useAgentStore.getState().setPipActive(true);
    useAgentStore.getState().setPipActive(false);
    expect(useAgentStore.getState().pipActive).toBe(false);
  });
});
