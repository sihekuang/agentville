import type { NormalizedAction } from "../providers/types";

const READ_CMDS = new Set([
  "ls","cat","sed","head","tail","rg","grep","find","bat","less",
  "wc","awk","tree","stat","file","pwd","nl","du","which","cd","echo",
]);

export function classifyCommand(cmd: string): "reading" | "executing" | "editing" {
  if (cmd.includes("apply_patch")) return "editing";

  const toks = cmd.split(/[\s;|&]+/).filter(Boolean);
  const meaningful = toks.filter((t) => !t.includes("=") && t !== "&&" && t !== "||");
  let i = 0;
  while (i < meaningful.length && (meaningful[i] === "cd" || meaningful[i] === "pwd")) i++;
  const first = meaningful[i] ?? "";

  if (first === "git") {
    const sub = meaningful[i + 1] ?? "";
    if (["diff", "log", "show", "status", "blame", "branch"].includes(sub)) return "reading";
    return "executing";
  }
  if (READ_CMDS.has(first)) return "reading";
  return "executing";
}

export type CodexEntry =
  | { timestamp: number; kind: "function_call"; name: string; cmd?: string; summary: string }
  | { timestamp: number; kind: "reasoning"; summary: string }
  | { timestamp: number; kind: "message"; role: "assistant"; summary: string };

interface RawLine {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    name?: string;
    arguments?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
    summary?: Array<{ type?: string; text?: string }>;
  };
}

function ts(s?: string): number {
  if (!s) return Date.now();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

export function parseCodexRolloutLine(line: string): CodexEntry | null {
  let raw: RawLine;
  try { raw = JSON.parse(line); } catch { return null; }
  if (raw.type !== "response_item") return null;
  const p = raw.payload;
  if (!p) return null;
  const timestamp = ts(raw.timestamp);

  if (p.type === "function_call") {
    const name = p.name ?? "";
    let cmd: string | undefined;
    if (name === "exec_command" || name === "shell") {
      try {
        const args = JSON.parse(p.arguments ?? "{}");
        if (typeof args.cmd === "string") {
          cmd = args.cmd;
        } else if (Array.isArray(args.command)) {
          const arr = args.command as string[];
          cmd = arr[arr.length - 1] ?? "";
        }
      } catch { /* leave cmd undefined */ }
    }
    const summary = cmd ? truncate(`$ ${cmd}`) : name;
    return { timestamp, kind: "function_call", name, cmd, summary };
  }

  if (p.type === "reasoning") {
    const first = (p.summary ?? []).find((b) => b.type === "summary_text" && b.text);
    const text = first?.text?.replace(/\*\*/g, "").trim();
    return { timestamp, kind: "reasoning", summary: text ? truncate(text) : "Thinking..." };
  }

  if (p.type === "message" && p.role === "assistant") {
    const block = (p.content ?? []).find((b) => (b.type === "output_text" || b.type === "text") && b.text);
    const text = block?.text ?? "assistant message";
    return { timestamp, kind: "message", role: "assistant", summary: truncate(text) };
  }

  return null;
}

export function parseCodexRollout(raw: string): CodexEntry[] {
  const out: CodexEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const e = parseCodexRolloutLine(line);
    if (e) out.push(e);
  }
  return out;
}

export function normalizeCodexAction(e: CodexEntry): NormalizedAction {
  if (e.kind === "reasoning") return "thinking";
  if (e.kind === "message") return "writing";
  switch (e.name) {
    case "exec_command":
    case "shell":
      return e.cmd ? classifyCommand(e.cmd) : "executing";
    case "write_stdin":
      return "executing";
    case "apply_patch":
    case "patch":
      return "editing";
    case "update_plan":
      return "delegating";
    default:
      return "other";
  }
}
