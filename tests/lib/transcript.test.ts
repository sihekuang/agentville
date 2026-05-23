import { describe, it, expect } from "vitest";
import { parseTranscriptLine, parseTranscriptFile } from "@/lib/transcript";
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
