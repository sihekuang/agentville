import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverSessions } from "@/lib/sessions";
import { parseTranscriptFile, currentActionFromTranscript } from "@/lib/transcript";
import { identifyAppFromProcessName } from "@/lib/host-app";
import { buildFocusScript } from "@/lib/focus-window";
import { useAgentStore } from "@/store/agents";

describe("integration: full pipeline", () => {
  const tmpDir = path.join(os.tmpdir(), "agentville-integration");
  const sessionsDir = path.join(tmpDir, "sessions");
  const projectsDir = path.join(tmpDir, "projects");
  const projectDir = path.join(projectsDir, "-Users-test-my-project");
  const fixturesDir = path.resolve(__dirname, "../../fixtures");

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    useAgentStore.setState({ agents: {}, selectedAgentId: null, theme: "office" });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers a session, parses its transcript, resolves host info, and populates the store", async () => {
    // 1. Write a session file
    const sessionData = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, "session-busy.json"), "utf-8")
    );
    fs.writeFileSync(
      path.join(sessionsDir, "12345.json"),
      JSON.stringify(sessionData)
    );

    // 2. Write a transcript
    fs.copyFileSync(
      path.join(fixturesDir, "transcript-sample.jsonl"),
      path.join(projectDir, "abc-123-def.jsonl")
    );

    // 3. Discover sessions (with PID always alive)
    const sessions = await discoverSessions(sessionsDir, () => true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("abc-123-def");

    // 4. Parse transcript
    const entries = parseTranscriptFile(
      path.join(projectDir, "abc-123-def.jsonl")
    );
    expect(entries.length).toBeGreaterThan(0);

    // 5. Derive current action
    const action = currentActionFromTranscript(entries);
    expect(["thinking", "writing", "tool:Read", "tool:Edit", "tool:Bash", "tool:Write", "idle", "tool:other", "tool:Agent"]).toContain(action);

    // 6. Test host app identification
    expect(identifyAppFromProcessName("/Applications/iTerm2.app/Contents/MacOS/iTerm2")).toEqual({
      type: "terminal",
      name: "iTerm2",
    });

    // 7. Test focus script building
    const script = buildFocusScript({
      type: "terminal",
      name: "iTerm2",
      pid: 123,
      cwd: "/test",
    });
    expect(script).toContain("activate");

    // 8. Populate store
    const store = useAgentStore.getState();
    store.addAgent({
      sessionId: sessions[0].sessionId,
      pid: sessions[0].pid,
      cwd: sessions[0].cwd,
      status: sessions[0].status,
      currentAction: action,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: sessions[0].startedAt,
      recentActions: entries.slice(-20),
    });

    const agents = useAgentStore.getState().agents;
    expect(Object.keys(agents)).toHaveLength(1);
    expect(agents["abc-123-def"].status).toBe("busy");
  });
});
