import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";

// Regression: a busy session whose cwd contains underscores (e.g.
// /Users/x/spain_trip_2026) must still resolve its transcript. Claude Code
// escapes every non-alphanumeric character in the cwd to "-" when naming the
// projects/ dir; when our escaping disagreed, the transcript was never found,
// currentAction fell back to "idle" while status stayed "busy", and the scene
// drew an awake sprite with no emote over its head.
describe("ClaudeCodeProvider with an underscore cwd", () => {
  const home = path.join(os.tmpdir(), "agentville-claude-underscore-itest");
  const sessionsDir = path.join(home, "sessions");
  const cwd = "/Users/test/spain_trip_2026";
  const escaped = "-Users-test-spain-trip-2026"; // what Claude Code writes on disk
  const projectDir = path.join(home, "projects", escaped);
  const sessionId = "underscore-sess-1";
  const transcriptFile = path.join(projectDir, `${sessionId}.jsonl`);

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
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }],
      },
      timestamp: 1_700_000_040_000,
    }));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it("derives currentAction from the transcript instead of falling back to idle", async () => {
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent).toBeDefined();
    expect(agent!.status).toBe("busy");
    expect(agent!.currentAction).toBe("shell");
  });

  it("exposes recent activity and a file-mtime activity signal", async () => {
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === `claude-code:${sessionId}`);
    expect(agent!.recentActivity.length).toBeGreaterThan(0);
    expect(agent!.lastTokenActivityAt).toBe(fs.statSync(transcriptFile).mtimeMs);
  });
});
