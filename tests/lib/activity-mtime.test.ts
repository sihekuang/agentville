import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { newestMtime } from "@/lib/activity-mtime";

describe("newestMtime", () => {
  const dir = path.join(os.tmpdir(), "agentville-newest-mtime-test");

  beforeEach(() => fs.mkdirSync(dir, { recursive: true }));
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (rel: string, mtimeMs: number) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "x");
    const t = mtimeMs / 1000;
    fs.utimesSync(p, t, t);
    return p;
  };

  it("returns the newest mtime among files", () => {
    const a = write("a.jsonl", 1_000_000);
    const b = write("b.jsonl", 3_000_000);
    expect(newestMtime([a, b])).toBe(fs.statSync(b).mtimeMs);
  });

  it("includes the newest immediate child of a directory", () => {
    const file = write("session.jsonl", 1_000_000);
    write("session/subagents/agent-1.jsonl", 5_000_000);
    const subagents = path.join(dir, "session", "subagents");
    const expected = fs.statSync(path.join(subagents, "agent-1.jsonl")).mtimeMs;
    expect(newestMtime([file, subagents])).toBe(expected);
  });

  it("skips missing paths", () => {
    const a = write("a.jsonl", 2_000_000);
    expect(newestMtime([a, path.join(dir, "does-not-exist")])).toBe(fs.statSync(a).mtimeMs);
  });

  it("returns undefined when nothing is stat-able", () => {
    expect(newestMtime([path.join(dir, "nope"), path.join(dir, "also-nope")])).toBeUndefined();
  });
});
