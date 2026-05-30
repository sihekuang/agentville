import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseCodexRollout,
  parseCodexRolloutLine,
  normalizeCodexAction,
  classifyCommand,
  type CodexEntry,
} from "@/lib/codex/rollout";
import type { NormalizedAction } from "@/lib/providers/types";

const FIXTURES = path.resolve(__dirname, "../../fixtures");

describe("classifyCommand", () => {
  it("classifies read commands as reading", () => {
    expect(classifyCommand("ls -la")).toBe("reading");
    expect(classifyCommand("cat README.md")).toBe("reading");
    expect(classifyCommand("rg --files")).toBe("reading");
    expect(classifyCommand("nl -ba src/x.ts | sed -n '1,10p'")).toBe("reading");
    expect(classifyCommand("git diff HEAD")).toBe("reading");
    expect(classifyCommand("git log --oneline")).toBe("reading");
    expect(classifyCommand("pwd && rg foo")).toBe("reading");
  });

  it("classifies edit commands (apply_patch) as editing", () => {
    expect(classifyCommand("apply_patch <<'EOF'\n*** Begin Patch\nEOF")).toBe("editing");
    expect(classifyCommand("cat foo | apply_patch")).toBe("editing");
  });

  it("classifies everything else as executing", () => {
    expect(classifyCommand("npm test")).toBe("executing");
    expect(classifyCommand("node script.js")).toBe("executing");
    expect(classifyCommand("git push origin main")).toBe("executing");
    expect(classifyCommand("./build.sh")).toBe("executing");
  });
});

describe("normalizeCodexAction", () => {
  const base = { timestamp: 0, summary: "x" };

  it("maps v0.135 exec_command by classifying its cmd", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "ls" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "npm test" })).toBe("executing");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "apply_patch <<EOF" })).toBe("editing");
  });

  it("maps legacy shell by classifying its first command token", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "shell", cmd: "cat README.md" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "shell", cmd: "npm install" })).toBe("executing");
  });

  it("maps write_stdin to executing", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "write_stdin" })).toBe("executing");
  });

  it("maps apply_patch tool to editing", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "apply_patch" })).toBe("editing");
  });

  it("maps update_plan to delegating", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "update_plan" })).toBe("delegating");
  });

  it("maps reasoning to thinking", () => {
    expect(normalizeCodexAction({ ...base, kind: "reasoning" })).toBe("thinking");
  });

  it("maps assistant message to writing", () => {
    expect(normalizeCodexAction({ ...base, kind: "message", role: "assistant" })).toBe("writing");
  });

  it("maps unknown function_call name to other", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "future_tool" })).toBe("other");
  });
});

describe("parseCodexRolloutLine", () => {
  it("returns null for non-response_item lines", () => {
    expect(parseCodexRolloutLine(JSON.stringify({ type: "session_meta", payload: {} }))).toBeNull();
    expect(parseCodexRolloutLine(JSON.stringify({ type: "event_msg", payload: {} }))).toBeNull();
    expect(parseCodexRolloutLine("not json")).toBeNull();
  });

  it("returns null for user messages and function_call_output", () => {
    expect(parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }
    }))).toBeNull();

    expect(parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "function_call_output", output: "ok", call_id: "x" }
    }))).toBeNull();
  });

  it("parses exec_command and extracts the cmd", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "function_call", name: "exec_command",
                 arguments: JSON.stringify({ cmd: "ls -la", workdir: "/p" }), call_id: "c1" }
    }))!;
    expect(e).not.toBeNull();
    expect(e.kind).toBe("function_call");
    expect((e as any).name).toBe("exec_command");
    expect((e as any).cmd).toBe("ls -la");
    expect(e.summary).toContain("ls -la");
  });

  it("parses legacy shell and joins the command array", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2025-09-29T00:00:00Z", type: "response_item",
      payload: { type: "function_call", name: "shell",
                 arguments: JSON.stringify({ command: ["bash","-lc","cat README.md"], workdir: "/p" }), call_id: "c2" }
    }))!;
    expect(e.kind).toBe("function_call");
    expect((e as any).name).toBe("shell");
    expect((e as any).cmd).toBe("cat README.md");
  });

  it("parses reasoning", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "reasoning", summary: [{ type: "summary_text", text: "**Thinking**" }] }
    }))!;
    expect(e.kind).toBe("reasoning");
    expect(e.summary).toBe("Thinking");
  });

  it("parses assistant message and truncates long text", () => {
    const longText = "x".repeat(200);
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: longText }] }
    }))!;
    expect(e.kind).toBe("message");
    expect((e as any).role).toBe("assistant");
    expect(e.summary.length).toBeLessThan(longText.length);
  });
});

describe("parseCodexRollout (against fixtures)", () => {
  it("parses the v0.135 sample fixture", () => {
    const raw = fs.readFileSync(path.join(FIXTURES, "codex-rollout-sample.jsonl"), "utf-8");
    const entries = parseCodexRollout(raw);
    // 7 mapped entries: reasoning + 3 exec_command + write_stdin + update_plan + assistant message
    // (user message and function_call_output are skipped)
    expect(entries.length).toBe(7);

    const actions: NormalizedAction[] = entries.map(normalizeCodexAction);
    expect(actions).toEqual([
      "thinking",   // reasoning
      "reading",    // exec_command: ls -la
      "executing",  // exec_command: npm test
      "editing",    // exec_command: apply_patch
      "executing",  // write_stdin
      "delegating", // update_plan
      "writing",    // assistant message
    ]);
  });

  it("parses the legacy v0.39 fixture", () => {
    const raw = fs.readFileSync(path.join(FIXTURES, "codex-rollout-legacy.jsonl"), "utf-8");
    const entries = parseCodexRollout(raw);
    // reasoning + shell(read) + shell(exec) + assistant message = 4
    expect(entries.length).toBe(4);

    const actions = entries.map(normalizeCodexAction);
    expect(actions).toEqual(["thinking", "reading", "executing", "writing"]);
  });
});
