import { describe, it, expect } from "vitest";
import { parseTranscriptLine, parseTranscriptFile, currentActionFromTranscript, lastTokenFlowAt } from "@/lib/transcript";
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
    });
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
      { timestamp: 1, type: "tool_use", summary: "WebSearch something" },
    ]);
    expect(action).toBe("other");
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

describe("lastTokenFlowAt", () => {
  it("returns the newest timestamp among assistant lines carrying usage", () => {
    const lines = [
      JSON.stringify({ type: "assistant", message: { role: "assistant", usage: { output_tokens: 5 } }, timestamp: 1000 }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", usage: { output_tokens: 2 } }, timestamp: 3000 }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hi" }] }, timestamp: 5000 }),
    ];
    expect(lastTokenFlowAt(lines)).toBe(3000);
  });

  it("counts an empty usage object (presence, not token count)", () => {
    const lines = [JSON.stringify({ type: "assistant", message: { role: "assistant", usage: {} }, timestamp: 4200 })];
    expect(lastTokenFlowAt(lines)).toBe(4200);
  });

  it("coerces ISO timestamps", () => {
    const iso = "2026-05-24T17:14:55.006Z";
    const lines = [JSON.stringify({ type: "assistant", message: { role: "assistant", usage: {} }, timestamp: iso })];
    expect(lastTokenFlowAt(lines)).toBe(new Date(iso).getTime());
  });

  it("returns undefined when no usage-bearing lines exist", () => {
    const lines = [
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hi" }] }, timestamp: 1000 }),
      JSON.stringify({ type: "user", message: { role: "user" }, timestamp: 2000 }),
    ];
    expect(lastTokenFlowAt(lines)).toBeUndefined();
  });

  it("ignores malformed and blank lines", () => {
    const lines = ["not json", "", JSON.stringify({ type: "assistant", message: { role: "assistant", usage: {} }, timestamp: 7000 })];
    expect(lastTokenFlowAt(lines)).toBe(7000);
  });
});
