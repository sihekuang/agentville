import { describe, it, expect } from "vitest";
import {
  discoverCodexProcesses,
  type CodexProcessScan,
  type CodexProcess,
} from "@/lib/codex/discovery";

describe("discoverCodexProcesses", () => {
  it("returns processes from the scan, extracting sessionId from rollout filename", async () => {
    const scan: CodexProcessScan = async () => [
      { pid: 78905,
        rolloutPath: "/Users/x/.codex/sessions/2026/05/29/rollout-2026-05-29T10-22-40-019e74c2-6ff6-7ca0-a1b3-7680efa2a743.jsonl",
        cwd: "/Users/x/proj" },
    ];
    const result = await discoverCodexProcesses(scan);
    expect(result).toEqual<CodexProcess[]>([
      {
        pid: 78905,
        sessionId: "019e74c2-6ff6-7ca0-a1b3-7680efa2a743",
        rolloutPath: "/Users/x/.codex/sessions/2026/05/29/rollout-2026-05-29T10-22-40-019e74c2-6ff6-7ca0-a1b3-7680efa2a743.jsonl",
        cwd: "/Users/x/proj",
      },
    ]);
  });

  it("skips processes whose rollout path has no extractable sessionId", async () => {
    const scan: CodexProcessScan = async () => [
      { pid: 1, rolloutPath: "/tmp/garbage.jsonl", cwd: "/" },
    ];
    expect(await discoverCodexProcesses(scan)).toEqual([]);
  });

  it("returns empty when scan returns nothing", async () => {
    const scan: CodexProcessScan = async () => [];
    expect(await discoverCodexProcesses(scan)).toEqual([]);
  });
});
