import { describe, it, expect } from "vitest";
import { toActivityEntry } from "@/lib/providers/claude-code";
import { toCodexActivityEntry } from "@/lib/providers/codex";

describe("toActivityEntry (Claude)", () => {
  it("maps a user_prompt entry to thinking with a turn boundary", () => {
    const entry = toActivityEntry({
      timestamp: 1700000030000,
      type: "user_prompt",
      summary: "fix the login bug",
    });
    expect(entry.category).toBe("thinking");
    expect(entry.rawType).toBe("user_prompt");
    expect(entry.turnBoundary).toBe(true);
  });

  it("does not mark assistant entries as turn boundaries", () => {
    const entry = toActivityEntry({
      timestamp: 1700000031000,
      type: "tool_use",
      summary: "Read /src/app.ts",
      toolName: "Read",
    });
    expect(entry.category).toBe("reading");
    expect(entry.turnBoundary).toBeUndefined();
  });
});

describe("toCodexActivityEntry (Codex)", () => {
  it("maps a user_message entry to thinking with a turn boundary", () => {
    const entry = toCodexActivityEntry({
      timestamp: 1700000030000,
      kind: "user_message",
      summary: "pick up last handed off context",
    });
    expect(entry.category).toBe("thinking");
    expect(entry.rawType).toBe("user_message");
    expect(entry.turnBoundary).toBe(true);
  });

  it("does not mark assistant entries as turn boundaries", () => {
    const entry = toCodexActivityEntry({
      timestamp: 1700000031000,
      kind: "function_call",
      name: "shell",
      cmd: "npm test",
      summary: "$ npm test",
    });
    expect(entry.category).toBe("executing");
    expect(entry.rawToolName).toBe("shell");
    expect(entry.turnBoundary).toBeUndefined();
  });
});
