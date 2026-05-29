import fs from "fs";
import type { TranscriptEntry } from "./types";
import type { NormalizedAction } from "./providers/types";

interface RawTranscriptLine {
  type: string;
  message?: {
    role: string;
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
    }>;
  };
  sessionId?: string;
  uuid?: string;
  parentUuid?: string;
  timestamp?: number | string;
  isSidechain?: boolean;
}

export function parseTranscriptLine(line: string): TranscriptEntry | null {
  let data: RawTranscriptLine;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }

  if (data.type !== "assistant") return null;

  const content = data.message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;

  const block = content[0];
  const rawTs = data.timestamp;
  const timestamp = typeof rawTs === "number" ? rawTs : rawTs ? new Date(rawTs).getTime() : Date.now();

  if (block.type === "tool_use") {
    const toolName = block.name ?? "unknown";
    const summary = formatToolSummary(toolName, block.input);
    return { timestamp, type: "tool_use", summary };
  }

  if (block.type === "thinking") {
    return { timestamp, type: "thinking", summary: "Thinking..." };
  }

  if (block.type === "text" && block.text) {
    const text =
      block.text.length > 80 ? block.text.slice(0, 77) + "..." : block.text;
    return { timestamp, type: "text", summary: text };
  }

  return null;
}

function formatToolSummary(
  name: string,
  input?: Record<string, unknown>
): string {
  if (!input) return name;

  if (name === "Read" && input.file_path) {
    return `Read ${input.file_path}`;
  }
  if (name === "Edit" && input.file_path) {
    return `Edit ${input.file_path}`;
  }
  if (name === "Write" && input.file_path) {
    return `Write ${input.file_path}`;
  }
  if (name === "Bash" && input.description) {
    return `Bash: ${input.description}`;
  }
  if (name === "Bash" && input.command) {
    const cmd = String(input.command);
    return `Bash: ${cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd}`;
  }
  if (name === "Agent" && input.description) {
    return `Agent: ${input.description}`;
  }

  return name;
}

export function currentActionFromTranscript(
  entries: TranscriptEntry[]
): NormalizedAction {
  if (entries.length === 0) return "idle";

  const last = entries[entries.length - 1];

  if (last.type === "thinking") return "thinking";
  if (last.type === "text") return "writing";

  if (last.type === "tool_use") {
    const toolName = last.summary.split(" ")[0].split(":")[0];
    switch (toolName) {
      case "Read": return "reading";
      case "Edit":
      case "Write": return "editing";
      case "Bash": return "executing";
      case "Agent": return "delegating";
      default: return "other";
    }
  }

  return "idle";
}

export function parseTranscriptFile(filePath: string): TranscriptEntry[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    const entry = parseTranscriptLine(line);
    if (entry) entries.push(entry);
  }

  return entries;
}
