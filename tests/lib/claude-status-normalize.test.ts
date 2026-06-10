import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider } from "@/lib/providers/claude-code";

describe("ClaudeCodeProvider status normalization", () => {
  const home = path.join(os.tmpdir(), "agentville-claude-status-itest");
  const sessionsDir = path.join(home, "sessions");

  const writeSession = (sessionId: string, status: string, cwd: string) => {
    fs.writeFileSync(
      path.join(sessionsDir, `${sessionId}.json`),
      JSON.stringify({
        pid: process.pid, // alive: this test process
        sessionId,
        cwd,
        startedAt: 1_700_000_000_000,
        procStart: "",
        version: "1.0.0",
        peerProtocol: 1,
        kind: "cli",
        entrypoint: "cli",
        status,
        updatedAt: 1_700_000_000_000,
      }),
    );
  };

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("treats 'shell' as busy + executing with a current activity signal", async () => {
    // Claude Code's session heartbeat reports "shell" while a command is
    // running. That is an authoritative "work in flight right now" signal:
    // the agent renders busy/executing and its activity timestamp is current,
    // so the idle override never demotes a session mid-command.
    const before = Date.now();
    writeSession("s-shell", "shell", "/Users/test/shellproj");
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === "claude-code:s-shell");
    expect(agent?.status).toBe("busy");
    expect(agent?.currentAction).toBe("executing");
    expect(agent?.lastTokenActivityAt).toBeGreaterThanOrEqual(before);
  });

  it("keeps idle as idle and maps waiting to busy", async () => {
    writeSession("s-idle", "idle", "/Users/test/idleproj");
    writeSession("s-wait", "waiting", "/Users/test/waitproj");
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    expect(agents.find((a) => a.id === "claude-code:s-idle")?.status).toBe("idle");
    expect(agents.find((a) => a.id === "claude-code:s-wait")?.status).toBe("busy");
  });
});
