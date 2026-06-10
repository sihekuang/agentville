import { describe, it, expect } from "vitest";
import {
  parseTranscriptLine,
  parseTranscriptFile,
  currentActionFromTranscript,
  actionForClaudeTool,
} from "@/lib/transcript";
import type { NormalizedAction } from "@/lib/providers/types";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../fixtures");

describe("parseTranscriptLine", () => {
  it("parses a tool_use line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "Read",
            input: { file_path: "/src/app.ts" },
          },
        ],
      },
      sessionId: "abc-123",
      uuid: "u1",
      timestamp: 1700000012000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000012000,
      type: "tool_use",
      summary: "Read /src/app.ts",
      toolName: "Read",
    });
  });

  it("prefers the tool_use block when a line has multiple content blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me check..." },
          { type: "text", text: "Checking the file now." },
          {
            type: "tool_use",
            id: "t9",
            name: "Bash",
            input: { command: "npm test" },
          },
        ],
      },
      sessionId: "abc-123",
      uuid: "u9",
      timestamp: 1700000020000,
    });

    const result = parseTranscriptLine(line);
    expect(result?.type).toBe("tool_use");
    expect(result?.toolName).toBe("Bash");
  });

  it("falls back to the text block when a multi-block line has no tool_use", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Hmm..." },
          { type: "text", text: "Here is my answer." },
        ],
      },
      sessionId: "abc-123",
      uuid: "u10",
      timestamp: 1700000021000,
    });

    const result = parseTranscriptLine(line);
    expect(result?.type).toBe("text");
    expect(result?.summary).toBe("Here is my answer.");
  });

  it("parses a thinking line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "Let me check..." }],
      },
      sessionId: "abc-123",
      uuid: "u2",
      timestamp: 1700000011000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000011000,
      type: "thinking",
      summary: "Thinking...",
    });
  });

  it("parses a text line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I fixed the bug in app.ts." }],
      },
      sessionId: "abc-123",
      uuid: "u3",
      timestamp: 1700000015000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000015000,
      type: "text",
      summary: "I fixed the bug in app.ts.",
    });
  });

  it("returns null for non-assistant lines", () => {
    const line = JSON.stringify({ type: "user", message: { role: "user" } });
    expect(parseTranscriptLine(line)).toBeNull();
  });

  it("returns null for attachment lines", () => {
    const line = JSON.stringify({ type: "attachment" });
    expect(parseTranscriptLine(line)).toBeNull();
  });
});

describe("parseTranscriptFile", () => {
  it("parses the fixture JSONL file and returns entries", () => {
    const entries = parseTranscriptFile(
      path.join(FIXTURES, "transcript-sample.jsonl")
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const toolUse = entries.find((e) => e.type === "tool_use");
    expect(toolUse).toBeDefined();
    expect(toolUse!.summary).toContain("Read");

    const thinking = entries.find((e) => e.type === "thinking");
    expect(thinking).toBeDefined();
    expect(thinking!.summary).toBe("Thinking...");
  });
});

describe("currentActionFromTranscript", () => {
  it("returns 'idle' for empty entries", () => {
    const action: NormalizedAction = currentActionFromTranscript([]);
    expect(action).toBe("idle");
  });

  it("returns 'thinking' for last thinking entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "thinking", summary: "Thinking..." },
    ]);
    expect(action).toBe("thinking");
  });

  it("returns 'writing' for last text entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "text", summary: "Here is the plan." },
    ]);
    expect(action).toBe("writing");
  });

  it("returns 'reading' for last Read tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Read /src/app.ts" },
    ]);
    expect(action).toBe("reading");
  });

  it("returns 'editing' for last Edit tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Edit /src/app.ts" },
    ]);
    expect(action).toBe("editing");
  });

  it("returns 'editing' for last Write tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Write /src/app.ts" },
    ]);
    expect(action).toBe("editing");
  });

  it("returns 'executing' for last Bash tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Bash: npm test" },
    ]);
    expect(action).toBe("executing");
  });

  it("returns 'delegating' for last Agent tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Agent: run sub-task" },
    ]);
    expect(action).toBe("delegating");
  });

  it("returns 'other' for unrecognized tool_use entry", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "SomeFutureTool input" },
    ]);
    expect(action).toBe("other");
  });

  it("uses the entry's toolName when present", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      {
        timestamp: 1,
        type: "tool_use",
        summary: "Asking about deploy strategy",
        toolName: "AskUserQuestion",
      },
    ]);
    expect(action).toBe("waiting");
  });

  it("uses the last entry when multiple entries are present", () => {
    const action: NormalizedAction = currentActionFromTranscript([
      { timestamp: 1, type: "tool_use", summary: "Read /src/app.ts" },
      { timestamp: 2, type: "thinking", summary: "Thinking..." },
      { timestamp: 3, type: "tool_use", summary: "Bash: npm test" },
    ]);
    expect(action).toBe("executing");
  });
});

describe("actionForClaudeTool", () => {
  const cases: Array<[string, NormalizedAction]> = [
    // reading / searching
    ["Read", "reading"],
    ["Glob", "reading"],
    ["Grep", "reading"],
    ["WebFetch", "reading"],
    ["WebSearch", "reading"],
    ["LSP", "reading"],
    ["ToolSearch", "reading"],
    ["ListMcpResourcesTool", "reading"],
    ["ReadMcpResourceTool", "reading"],
    ["TaskGet", "reading"],
    ["TaskList", "reading"],
    ["NotebookRead", "reading"],
    // editing
    ["Edit", "editing"],
    ["Write", "editing"],
    ["MultiEdit", "editing"],
    ["NotebookEdit", "editing"],
    // executing
    ["Bash", "executing"],
    ["BashOutput", "executing"],
    ["KillShell", "executing"],
    ["PowerShell", "executing"],
    ["Monitor", "executing"],
    ["Skill", "executing"],
    ["SlashCommand", "executing"],
    ["TaskStop", "executing"],
    ["TaskOutput", "executing"],
    // delegating
    ["Agent", "delegating"],
    ["Task", "delegating"], // legacy name of the Agent tool
    ["Workflow", "delegating"],
    ["SendMessage", "delegating"],
    ["TeamCreate", "delegating"],
    ["TeamDelete", "delegating"],
    // waiting on the user
    ["AskUserQuestion", "waiting"],
    ["ExitPlanMode", "waiting"],
    // planning
    ["TodoWrite", "thinking"],
    ["TaskCreate", "thinking"],
    ["TaskUpdate", "thinking"],
    ["EnterPlanMode", "thinking"],
    // catch-all
    ["mcp__BrowserOS__take_screenshot", "other"],
    ["SomeFutureTool", "other"],
  ];

  it.each(cases)("maps %s to %s", (tool, expected) => {
    expect(actionForClaudeTool(tool)).toBe(expected);
  });
});
