import { describe, it, expect } from "vitest";
import { makeAgentId, parseAgentId } from "@/lib/providers/types";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";

describe("Agent id format for Claude Code", () => {
  it("ClaudeCodeProvider exposes name 'claude-code'", () => {
    expect(new ClaudeCodeProvider().name).toBe("claude-code");
  });

  it("makeAgentId+parseAgentId round-trip for a Claude session id", () => {
    const id = makeAgentId("claude-code", "abc-123-def");
    expect(id).toBe("claude-code:abc-123-def");
    expect(parseAgentId(id)).toEqual({ provider: "claude-code", sessionId: "abc-123-def" });
  });
});
