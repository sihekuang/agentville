import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";

describe("ClaudeCodeProvider lastTokenActivityAt (file-mtime signal)", () => {
  const home = path.join(os.tmpdir(), "agentville-claude-token-itest");
  const sessionsDir = path.join(home, "sessions");
  const cwd = "/Users/test/proj";
  const escaped = cwd.replace(/[/.]/g, "-");
  const projectDir = path.join(home, "projects", escaped);
  const sessionId = "tok-sess-1";
  const transcriptFile = path.join(projectDir, `${sessionId}.jsonl`);

  const setMtime = (p: string, ms: number) => fs.utimesSync(p, ms / 1000, ms / 1000);

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify({
      pid: process.pid, // alive: this test process
      sessionId, cwd,
      startedAt: 1_700_000_000_000, procStart: "", version: "1.0.0",
      peerProtocol: 1, kind: "cli", entrypoint: "cli",
      status: "busy", updatedAt: 1_700_000_000_000,
    }));
    fs.writeFileSync(transcriptFile, JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "done" }] },
      timestamp: 1_700_000_040_000,
    }));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it("uses the transcript file's mtime, not the embedded timestamp", async () => {
    setMtime(transcriptFile, 1_700_000_900_000); // mtime far from the line's recorded ts
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent).toBeDefined();
    expect(agent!.lastTokenActivityAt).toBe(fs.statSync(transcriptFile).mtimeMs);
  });

  it("picks up fresher activity from the session's subagents/ subtree", async () => {
    setMtime(transcriptFile, 1_700_000_100_000);
    const subDir = path.join(projectDir, sessionId, "subagents");
    fs.mkdirSync(subDir, { recursive: true });
    const subFile = path.join(subDir, "agent-x.jsonl");
    fs.writeFileSync(subFile, "{}");
    setMtime(subFile, 1_700_000_500_000); // newer than the main transcript

    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent!.lastTokenActivityAt).toBe(fs.statSync(subFile).mtimeMs);
  });
});
