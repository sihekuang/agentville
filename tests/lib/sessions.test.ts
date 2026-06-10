import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { discoverSessions, escapeCwd, getTranscriptPath } from "@/lib/sessions";
import fs from "fs";
import path from "path";
import os from "os";

const FIXTURES = path.resolve(__dirname, "../../fixtures");

describe("discoverSessions", () => {
  const mockSessionsDir = path.join(os.tmpdir(), "agentville-test-sessions");

  beforeEach(() => {
    fs.mkdirSync(mockSessionsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(mockSessionsDir, { recursive: true, force: true });
  });

  it("returns empty array when no session files exist", async () => {
    const result = await discoverSessions(mockSessionsDir);
    expect(result).toEqual([]);
  });

  it("parses a valid session file", async () => {
    const fixture = fs.readFileSync(
      path.join(FIXTURES, "session-busy.json"),
      "utf-8"
    );
    fs.writeFileSync(path.join(mockSessionsDir, "12345.json"), fixture);

    const result = await discoverSessions(mockSessionsDir, () => true);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("abc-123-def");
    expect(result[0].status).toBe("busy");
    expect(result[0].pid).toBe(12345);
    expect(result[0].cwd).toBe("/Users/test/my-project");
  });

  it("skips files with invalid JSON", async () => {
    fs.writeFileSync(path.join(mockSessionsDir, "bad.json"), "not json");

    const result = await discoverSessions(mockSessionsDir);
    expect(result).toEqual([]);
  });

  it("filters out sessions whose PID is not alive", async () => {
    const fixture = fs.readFileSync(
      path.join(FIXTURES, "session-busy.json"),
      "utf-8"
    );
    fs.writeFileSync(path.join(mockSessionsDir, "12345.json"), fixture);

    const result = await discoverSessions(mockSessionsDir, () => false);
    expect(result).toEqual([]);
  });
});

describe("escapeCwd", () => {
  it("replaces slashes and dots with dashes", () => {
    expect(escapeCwd("/Users/test/my.project")).toBe("-Users-test-my-project");
  });

  // Claude Code escapes EVERY non-alphanumeric character to "-", not just "/"
  // and ".": /Users/x/spain_trip_2026 lives at projects/-Users-x-spain-trip-2026.
  it("replaces underscores like Claude Code does", () => {
    expect(escapeCwd("/Users/test/spain_trip_2026")).toBe(
      "-Users-test-spain-trip-2026"
    );
  });

  it("replaces other non-alphanumeric characters (spaces, @) like Claude Code does", () => {
    expect(escapeCwd("/Users/test/my app@v2")).toBe("-Users-test-my-app-v2");
  });
});

describe("getTranscriptPath", () => {
  const mockProjectsDir = path.join(os.tmpdir(), "agentville-test-projects");

  beforeEach(() => {
    fs.mkdirSync(mockProjectsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(mockProjectsDir, { recursive: true, force: true });
  });

  it("finds the transcript for a cwd containing underscores", () => {
    const escaped = "-Users-test-spain-trip-2026";
    const sessionId = "sess-1";
    fs.mkdirSync(path.join(mockProjectsDir, escaped), { recursive: true });
    const jsonl = path.join(mockProjectsDir, escaped, `${sessionId}.jsonl`);
    fs.writeFileSync(jsonl, "");

    expect(
      getTranscriptPath(mockProjectsDir, "/Users/test/spain_trip_2026", sessionId)
    ).toBe(jsonl);
  });
});
