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

  it("sees files nested several levels below a swept directory (workflow run files)", () => {
    const transcript = write("session.jsonl", 1_000_000);
    const nested = write(
      "session/subagents/workflows/wf-run-1/agent-1.jsonl",
      7_000_000
    );
    // Freeze the intermediate dirs older than everything: appending to a
    // nested file does not bump its ancestor directories' mtimes, so the
    // sweep must reach the file itself.
    const subagents = path.join(dir, "session", "subagents");
    for (const d of [
      subagents,
      path.join(subagents, "workflows"),
      path.join(subagents, "workflows", "wf-run-1"),
    ]) {
      fs.utimesSync(d, 2, 2);
    }
    expect(newestMtime([transcript, subagents])).toBe(
      fs.statSync(nested).mtimeMs
    );
  });

  it("ignores files deeper than the sweep depth cap", () => {
    const a = write("a.jsonl", 9_000_000);
    // 6 entry levels below the swept dir — one past the cap of 5.
    write("deep/1/2/3/4/5/too-deep.jsonl", 99_000_000);
    const deep = path.join(dir, "deep");
    let d = deep;
    fs.utimesSync(d, 2, 2);
    for (const seg of ["1", "2", "3", "4", "5"]) {
      d = path.join(d, seg);
      fs.utimesSync(d, 2, 2);
    }
    expect(newestMtime([a, deep])).toBe(fs.statSync(a).mtimeMs);
  });

  it("skips missing paths", () => {
    const a = write("a.jsonl", 2_000_000);
    expect(newestMtime([a, path.join(dir, "does-not-exist")])).toBe(fs.statSync(a).mtimeMs);
  });

  it("returns undefined when nothing is stat-able", () => {
    expect(newestMtime([path.join(dir, "nope"), path.join(dir, "also-nope")])).toBeUndefined();
  });
});
