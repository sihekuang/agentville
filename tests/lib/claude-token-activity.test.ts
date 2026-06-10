import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";
import { escapeCwd } from "@/lib/sessions";

describe("ClaudeCodeProvider lastTokenActivityAt (file-mtime signal)", () => {
  const home = path.join(os.tmpdir(), "agentville-claude-token-itest");
  const sessionsDir = path.join(home, "sessions");
  const cwd = "/Users/test/proj";
  const escaped = escapeCwd(cwd);
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

  it("picks up fresher activity from workflow run files nested under subagents/", async () => {
    setMtime(transcriptFile, 1_700_000_100_000);
    // A background Workflow writes its live output to
    // <sessionDir>/subagents/workflows/<runId>/agent-*.jsonl + journal.jsonl.
    const runDir = path.join(
      projectDir, sessionId, "subagents", "workflows", "wf_abc123"
    );
    fs.mkdirSync(runDir, { recursive: true });
    const agentFile = path.join(runDir, "agent-a1.jsonl");
    fs.writeFileSync(agentFile, "{}");
    setMtime(agentFile, 1_700_000_700_000); // newer than the main transcript
    // Appends don't bump ancestor dir mtimes — freeze them older than the
    // transcript to model a long-running workflow between turns.
    setMtime(runDir, 1_700_000_050_000);
    setMtime(path.dirname(runDir), 1_700_000_050_000);
    setMtime(path.join(projectDir, sessionId, "subagents"), 1_700_000_050_000);

    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent!.lastTokenActivityAt).toBe(fs.statSync(agentFile).mtimeMs);
  });

  it("picks up fresher activity from background task output files", async () => {
    setMtime(transcriptFile, 1_700_000_100_000);
    // Background task output streams to <tasksBase>/<escaped-cwd>/<sessionId>/tasks/
    const tasksBase = path.join(home, "tmp-tasks");
    const tasksDir = path.join(tasksBase, escaped, sessionId, "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    const outFile = path.join(tasksDir, "bg-1.output");
    fs.writeFileSync(outFile, "building...");
    setMtime(outFile, 1_700_000_800_000); // newer than the main transcript

    const agents = await new ClaudeCodeProvider(home, { tasksBaseDir: tasksBase }).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent!.lastTokenActivityAt).toBe(fs.statSync(outFile).mtimeMs);
  });
});
