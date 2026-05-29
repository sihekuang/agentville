import { describe, it, expect } from "vitest";
import { makeAgentId, parseAgentId } from "@/lib/providers/types";

describe("makeAgentId", () => {
  it("joins provider and sessionId with a colon", () => {
    expect(makeAgentId("claude-code", "abc-123")).toBe("claude-code:abc-123");
    expect(makeAgentId("codex", "019e74c2-6ff6-7ca0-a1b3-7680efa2a743")).toBe(
      "codex:019e74c2-6ff6-7ca0-a1b3-7680efa2a743"
    );
  });

  it("rejects empty inputs", () => {
    expect(() => makeAgentId("", "abc")).toThrow();
    expect(() => makeAgentId("claude-code", "")).toThrow();
  });

  it("rejects a provider name containing a colon", () => {
    expect(() => makeAgentId("claude:code", "abc")).toThrow();
  });
});

describe("parseAgentId", () => {
  it("splits on the first colon", () => {
    expect(parseAgentId("claude-code:abc-123")).toEqual({
      provider: "claude-code",
      sessionId: "abc-123",
    });
  });

  it("preserves colons inside sessionId", () => {
    // Defensive: UUIDs do not contain ':' but be safe anyway.
    expect(parseAgentId("codex:abc:def")).toEqual({
      provider: "codex",
      sessionId: "abc:def",
    });
  });

  it("returns null for malformed ids", () => {
    expect(parseAgentId("no-colon-here")).toBeNull();
    expect(parseAgentId(":missing-provider")).toBeNull();
    expect(parseAgentId("missing-session:")).toBeNull();
  });

  it("round-trips with makeAgentId", () => {
    const id = makeAgentId("claude-code", "abc-123-def");
    expect(parseAgentId(id)).toEqual({ provider: "claude-code", sessionId: "abc-123-def" });
  });
});
