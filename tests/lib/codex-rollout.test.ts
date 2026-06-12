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

  it("classifies everything else as shell", () => {
    expect(classifyCommand("npm test")).toBe("shell");
    expect(classifyCommand("node script.js")).toBe("shell");
    expect(classifyCommand("git push origin main")).toBe("shell");
    expect(classifyCommand("./build.sh")).toBe("shell");
  });
});

describe("normalizeCodexAction", () => {
  const base = { timestamp: 0, summary: "x" };

  it("maps v0.135 exec_command by classifying its cmd", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "ls" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "npm test" })).toBe("shell");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "exec_command", cmd: "apply_patch <<EOF" })).toBe("editing");
  });

  it("maps legacy shell by classifying its first command token", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "shell", cmd: "cat README.md" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "shell", cmd: "npm install" })).toBe("shell");
  });

  it("maps write_stdin to shell", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "write_stdin" })).toBe("shell");
  });

  it("maps apply_patch tool to editing", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "apply_patch" })).toBe("editing");
  });

  it("maps update_plan to thinking (planning, consistent with Claude's TaskCreate/TaskUpdate)", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "update_plan" })).toBe("thinking");
  });

  it("maps unified_exec by classifying its cmd", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "unified_exec", cmd: "cat foo.ts" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "unified_exec", cmd: "npm test" })).toBe("shell");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "unified_exec" })).toBe("shell");
  });

  it("maps view_image and web_search to reading", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "view_image" })).toBe("reading");
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "web_search" })).toBe("reading");
  });

  it("maps request_user_input to waiting", () => {
    expect(normalizeCodexAction({ ...base, kind: "function_call", name: "request_user_input" })).toBe("waiting");
  });

  it("maps multi-agent tools to delegating", () => {
    for (const name of [
      "spawn_agent", "send_input", "send_message", "followup_task",
      "resume_agent", "wait_agent", "list_agents", "close_agent", "interrupt_agent",
    ]) {
      expect(normalizeCodexAction({ ...base, kind: "function_call", name })).toBe("delegating");
    }
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

  it("maps user_message to thinking (new turn, model not yet streaming)", () => {
    expect(normalizeCodexAction({ ...base, kind: "user_message" })).toBe("thinking");
  });
});

describe("parseCodexRolloutLine", () => {
  it("returns null for non-response_item lines", () => {
    expect(parseCodexRolloutLine(JSON.stringify({ type: "session_meta", payload: {} }))).toBeNull();
    expect(parseCodexRolloutLine(JSON.stringify({ type: "event_msg", payload: {} }))).toBeNull();
    expect(parseCodexRolloutLine("not json")).toBeNull();
  });

  it("returns null for function_call_output", () => {
    expect(parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-29T00:00:00Z", type: "response_item",
      payload: { type: "function_call_output", output: "ok", call_id: "x" }
    }))).toBeNull();
  });

  it("parses a user message into a user_message entry (turn boundary)", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-30T03:13:38.839Z", type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "pick up last handed off context" }] }
    }))!;
    expect(e).not.toBeNull();
    expect(e.kind).toBe("user_message");
    expect(e.summary).toBe("pick up last handed off context");
    expect(e.timestamp).toBe(Date.parse("2026-05-30T03:13:38.839Z"));
  });

  it("ignores harness-injected context wrappers sent as user messages", () => {
    for (const text of [
      "<environment_context>\n  <cwd>/p</cwd>\n</environment_context>",
      "<user_instructions>\nBe nice.\n</user_instructions>",
    ]) {
      expect(parseCodexRolloutLine(JSON.stringify({
        timestamp: "2026-05-30T03:13:38.836Z", type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text }] }
      }))).toBeNull();
    }
  });

  it("ignores event_msg user_message duplicates of the prompt", () => {
    // The same prompt arrives twice: as a response_item AND an event_msg.
    // Only the response_item becomes an entry.
    expect(parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-05-30T03:13:38.839Z", type: "event_msg",
      payload: { type: "user_message", message: "pick up last handed off context" }
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

  it("parses custom_tool_call apply_patch (how Codex actually delivers edits)", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-06-01T00:00:00Z", type: "response_item",
      payload: { type: "custom_tool_call", name: "apply_patch",
                 input: "*** Begin Patch\n*** Update File: src/x.ts\n*** End Patch", call_id: "c3" }
    }))!;
    expect(e).not.toBeNull();
    expect(e.kind).toBe("function_call");
    expect((e as any).name).toBe("apply_patch");
    expect(normalizeCodexAction(e)).toBe("editing");
  });

  it("parses local_shell_call and classifies its command", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-06-01T00:00:00Z", type: "response_item",
      payload: { type: "local_shell_call", status: "completed", call_id: "c4",
                 action: { type: "exec", command: ["bash", "-lc", "cat README.md"] } }
    }))!;
    expect(e).not.toBeNull();
    expect((e as any).cmd).toBe("cat README.md");
    expect(normalizeCodexAction(e)).toBe("reading");
  });

  it("parses local_shell_call with a shell-class command into a shell action", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-06-01T00:00:00Z", type: "response_item",
      payload: { type: "local_shell_call", status: "completed", call_id: "c5",
                 action: { type: "exec", command: ["bash", "-lc", "npm test"] } }
    }))!;
    expect(e).not.toBeNull();
    expect((e as any).cmd).toBe("npm test");
    expect(normalizeCodexAction(e)).toBe("shell");
  });

  it("parses web_search_call into a reading action with the query", () => {
    const e = parseCodexRolloutLine(JSON.stringify({
      timestamp: "2026-06-01T00:00:00Z", type: "response_item",
      payload: { type: "web_search_call", status: "completed",
                 action: { type: "search", query: "vitest mock fs" } }
    }))!;
    expect(e).not.toBeNull();
    expect(e.summary).toContain("vitest mock fs");
    expect(normalizeCodexAction(e)).toBe("reading");
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
    // 8 mapped entries: user prompt + reasoning + 3 exec_command + write_stdin
    // + update_plan + assistant message (function_call_output is skipped)
    expect(entries.length).toBe(8);
    expect(entries[0].kind).toBe("user_message");

    const actions: NormalizedAction[] = entries.map(normalizeCodexAction);
    expect(actions).toEqual([
      "thinking",   // user prompt (turn boundary)
      "thinking",   // reasoning
      "reading",    // exec_command: ls -la
      "shell",      // exec_command: npm test
      "editing",    // exec_command: apply_patch
      "shell",      // write_stdin
      "thinking",   // update_plan (planning)
      "writing",    // assistant message
    ]);
  });

  it("parses the legacy v0.39 fixture", () => {
    const raw = fs.readFileSync(path.join(FIXTURES, "codex-rollout-legacy.jsonl"), "utf-8");
    const entries = parseCodexRollout(raw);
    // user prompt + reasoning + shell(read) + shell(exec) + assistant message = 5
    expect(entries.length).toBe(5);
    expect(entries[0].kind).toBe("user_message");

    const actions = entries.map(normalizeCodexAction);
    expect(actions).toEqual(["thinking", "thinking", "reading", "shell", "writing"]);
  });
});
