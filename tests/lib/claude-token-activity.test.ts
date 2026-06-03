import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";

describe("ClaudeCodeProvider lastTokenActivityAt", () => {
  const home = path.join(os.tmpdir(), "agentville-claude-token-itest");
  const sessionsDir = path.join(home, "sessions");
  const cwd = "/Users/test/proj";
  const escaped = cwd.replace(/[/.]/g, "-");
  const projectDir = path.join(home, "projects", escaped);
  const sessionId = "tok-sess-1";
  const usageTs = 1_700_000_050_000;

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    const session = {
      pid: process.pid, // alive: this test process
      sessionId,
      cwd,
      startedAt: 1_700_000_000_000,
      procStart: "",
      version: "1.0.0",
      peerProtocol: 1,
      kind: "cli",
      entrypoint: "cli",
      status: "busy",
      updatedAt: usageTs,
    };
    fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session));
    const transcript = [
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Read", input: { file_path: "/a" } }], usage: { output_tokens: 7 } }, timestamp: 1_700_000_040_000 }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "done" }], usage: { output_tokens: 3 } }, timestamp: usageTs }),
    ].join("\n");
    fs.writeFileSync(path.join(projectDir, `${sessionId}.jsonl`), transcript);
  });
  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("sets lastTokenActivityAt from the newest usage-bearing transcript line", async () => {
    const provider = new ClaudeCodeProvider(home);
    const agents = await provider.discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent).toBeDefined();
    expect(agent!.lastTokenActivityAt).toBe(usageTs);
  });
});
