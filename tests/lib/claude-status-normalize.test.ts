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

  it("normalizes a non-canonical 'shell' status to busy (so it can later stall)", async () => {
    // Claude Code writes statuses like "shell" that aren't in the canonical
    // vocabulary. They must collapse to "busy" so applyIdleOverride can act on
    // them and the scene doesn't paint a quiet shell session as "working" forever.
    writeSession("s-shell", "shell", "/Users/test/shellproj");
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    expect(agents.find((a) => a.id === "claude-code:s-shell")?.status).toBe("busy");
  });

  it("keeps idle as idle and maps waiting to busy", async () => {
    writeSession("s-idle", "idle", "/Users/test/idleproj");
    writeSession("s-wait", "waiting", "/Users/test/waitproj");
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    expect(agents.find((a) => a.id === "claude-code:s-idle")?.status).toBe("idle");
    expect(agents.find((a) => a.id === "claude-code:s-wait")?.status).toBe("busy");
  });
});
