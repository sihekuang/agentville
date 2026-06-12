import fs from "fs";
import type { NormalizedAction } from "./providers/types";

export interface TranscriptEntry {
  timestamp: number;
  type:
    | "tool_use"
    | "thinking"
    | "text"
    | "subagent_start"
    | "subagent_stop"
    | "user_prompt";
  summary: string;
  /** Exact tool name for tool_use entries (e.g. "Read", "mcp__server__tool"). */
  toolName?: string;
}

/**
 * Map a Claude Code tool name to a NormalizedAction.
 * Covers the full built-in tool set (per the official tools reference),
 * including legacy names still emitted by older CLI versions
 * (Task, MultiEdit, TodoWrite, KillShell). Unknown tools — including
 * mcp__* server tools — fall through to "other".
 */
const CLAUDE_TOOL_ACTIONS: Record<string, NormalizedAction> = {
  // reading / searching
  Read: "reading",
  Glob: "reading",
  Grep: "reading",
  WebFetch: "reading",
  WebSearch: "reading",
  LSP: "reading",
  ToolSearch: "reading",
  ListMcpResourcesTool: "reading",
  ReadMcpResourceTool: "reading",
  TaskGet: "reading",
  TaskList: "reading",
  NotebookRead: "reading",
  // editing
  Edit: "editing",
  Write: "editing",
  MultiEdit: "editing",
  NotebookEdit: "editing",
  // executing
  Bash: "executing",
  BashOutput: "executing",
  KillShell: "executing",
  PowerShell: "executing",
  Monitor: "executing",
  Skill: "executing",
  SlashCommand: "executing",
  TaskStop: "executing",
  TaskOutput: "executing",
  // delegating
  Agent: "delegating",
  Task: "delegating",
  Workflow: "delegating",
  SendMessage: "delegating",
  TeamCreate: "delegating",
  TeamDelete: "delegating",
  // blocked on the user
  AskUserQuestion: "waiting",
  ExitPlanMode: "waiting",
  // planning
  TodoWrite: "thinking",
  TaskCreate: "thinking",
  TaskUpdate: "thinking",
  EnterPlanMode: "thinking",
};

export function actionForClaudeTool(toolName: string): NormalizedAction {
  return CLAUDE_TOOL_ACTIONS[toolName] ?? "other";
}

interface RawTranscriptLine {
  type: string;
  message?: {
    role: string;
    content?:
      | string
      | Array<{
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
  isMeta?: boolean;
}

function truncateText(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/**
 * Extract the prompt text of a user-role line, or null when the line isn't a
 * real prompt: tool results (recorded as user-role lines), meta lines, and
 * local-command noise (`<command-name>`, `<local-command-stdout>`).
 */
function userPromptText(data: RawTranscriptLine): string | null {
  if (data.isMeta) return null;
  const content = data.message?.content;
  let text: string | undefined;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    if (content.some((b) => b.type === "tool_result")) return null;
    text = content.find((b) => b.type === "text" && b.text)?.text;
  }
  if (!text || text.startsWith("<command-") || text.startsWith("<local-command-")) {
    return null;
  }
  return text;
}

export function parseTranscriptLine(line: string): TranscriptEntry | null {
  let data: RawTranscriptLine;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }

  const rawTs = data.timestamp;
  const timestamp = typeof rawTs === "number" ? rawTs : rawTs ? new Date(rawTs).getTime() : Date.now();

  // User prompts mark turn boundaries: a new prompt means any state derived
  // from earlier entries is stale, so they must become entries too.
  if (data.type === "user") {
    const text = userPromptText(data);
    if (!text) return null;
    return { timestamp, type: "user_prompt", summary: truncateText(text) };
  }

  if (data.type !== "assistant") return null;

  const content = data.message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;

  // A line can carry several blocks (e.g. [thinking, text, tool_use]).
  // The tool_use block is the action actually in flight, so it wins;
  // a text block beats a bare thinking block.
  const block =
    content.filter((b) => b.type === "tool_use").pop() ??
    content.find((b) => b.type === "text" && b.text) ??
    content[0];

  if (block.type === "tool_use") {
    const toolName = block.name ?? "unknown";
    const summary = formatToolSummary(toolName, block.input);
    return { timestamp, type: "tool_use", summary, toolName };
  }

  if (block.type === "thinking") {
    return { timestamp, type: "thinking", summary: "Thinking..." };
  }

  if (block.type === "text" && block.text) {
    return { timestamp, type: "text", summary: truncateText(block.text) };
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
  // A new user prompt means the model is processing it but hasn't streamed
  // anything yet — the previous turn's last action is no longer current.
  if (last.type === "user_prompt") return "thinking";

  if (last.type === "tool_use") {
    return actionForClaudeTool(toolNameOf(last));
  }

  return "idle";
}

/** Tool name of a tool_use entry, falling back to parsing the summary. */
export function toolNameOf(entry: TranscriptEntry): string {
  return entry.toolName ?? entry.summary.split(" ")[0].split(":")[0];
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
