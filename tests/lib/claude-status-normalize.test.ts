import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeCodeProvider, actionForShellStatus } from "@/lib/providers/claude-code";
import type { TranscriptEntry } from "@/lib/transcript";

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

  it("treats 'shell' as busy + shell with a current activity signal", async () => {
    // Claude Code's session heartbeat reports "shell" while a command is
    // running. That is an authoritative "work in flight right now" signal:
    // the agent renders busy/shell and its activity timestamp is current,
    // so the idle override never demotes a session mid-command.
    const before = Date.now();
    writeSession("s-shell", "shell", "/Users/test/shellproj");
    const agents = await new ClaudeCodeProvider(home).discoverAgents();
    const agent = agents.find((a) => a.id === "claude-code:s-shell");
    expect(agent?.status).toBe("busy");
    expect(agent?.currentAction).toBe("shell");
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

describe("actionForShellStatus", () => {
  const at = (type: TranscriptEntry["type"], summary = ""): TranscriptEntry =>
    ({ timestamp: 1, type, summary } as TranscriptEntry);

  it("is 'shell' when there is no transcript (a command is asserted running)", () => {
    expect(actionForShellStatus([])).toBe("shell");
  });

  it("is 'shell' when the newest entry is a shell command", () => {
    const bash = { timestamp: 1, type: "tool_use", summary: "Bash: npm run dev" } as TranscriptEntry;
    expect(actionForShellStatus([at("text", "done"), bash])).toBe("shell");
  });

  it("is 'shell' when the newest entry is a turn-final reply (status outranks a lagging transcript)", () => {
    const bash = { timestamp: 1, type: "tool_use", summary: "Bash: npm run dev:full &" } as TranscriptEntry;
    expect(actionForShellStatus([bash, at("text", "started it")])).toBe("shell");
  });

  it("is 'shell' when the newest entry is thinking", () => {
    expect(actionForShellStatus([at("thinking")])).toBe("shell");
  });

  it("is 'shell' when status is fresh but the transcript tail is a stale reply", () => {
    // Live repro: the session status flips to "shell" for a new foreground
    // command BEFORE the transcript records it (the transcript file lags the
    // status file by minutes). The newest parseable entry is then the PREVIOUS
    // turn's text reply — a non-shell tail that must NOT be read as monitoring.
    const bash = { timestamp: 1, type: "tool_use", summary: "Bash: npm test" } as TranscriptEntry;
    expect(actionForShellStatus([bash, at("text", "Good — that passed")])).toBe("shell");
  });

  it("is 'monitoring' only when the agent is actively polling live output", () => {
    const bashOutput = {
      timestamp: 1,
      type: "tool_use",
      summary: "BashOutput",
      toolName: "BashOutput",
    } as TranscriptEntry;
    expect(actionForShellStatus([bashOutput])).toBe("monitoring");
  });
});
