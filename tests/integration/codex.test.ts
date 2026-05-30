import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { CodexProvider } from "@/lib/providers/codex";
import type { CodexProcessScan } from "@/lib/codex/discovery";

describe("CodexProvider (integration)", () => {
  const tmp = path.join(os.tmpdir(), "agentville-codex-itest");
  const fixturesDir = path.resolve(__dirname, "../../fixtures");
  const rolloutSrc = path.join(fixturesDir, "codex-rollout-sample.jsonl");
  const rolloutDest = path.join(tmp, "rollout-2026-05-29T10-22-40-019e74c2-6ff6-7ca0-a1b3-7680efa2a743.jsonl");

  beforeEach(() => {
    fs.mkdirSync(tmp, { recursive: true });
    fs.copyFileSync(rolloutSrc, rolloutDest);
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("discovers a live codex agent with the namespaced id and normalized activity", async () => {
    const fakeScan: CodexProcessScan = async () => [
      { pid: 78905, rolloutPath: rolloutDest, cwd: "/Users/test/proj" },
    ];

    const provider = new CodexProvider({ scan: fakeScan });
    const agents = await provider.discoverAgents();

    expect(agents).toHaveLength(1);
    const a = agents[0];
    expect(a.provider).toBe("codex");
    expect(a.id).toBe("codex:019e74c2-6ff6-7ca0-a1b3-7680efa2a743");
    expect(a.pid).toBe(78905);
    expect(a.cwd).toBe("/Users/test/proj");
    expect(a.recentActivity.length).toBeGreaterThan(0);
    // Last assistant message dominates currentAction
    expect(a.currentAction).toBe("writing");
    expect(["busy", "idle", "waiting"]).toContain(a.status);
  });

  it("returns no agents when the scan finds nothing", async () => {
    const fakeScan: CodexProcessScan = async () => [];
    const provider = new CodexProvider({ scan: fakeScan });
    expect(await provider.discoverAgents()).toEqual([]);
  });
});
