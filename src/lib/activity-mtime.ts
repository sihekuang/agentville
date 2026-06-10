import fs from "fs";
import path from "path";

/**
 * How many entry levels below a swept directory the sweep descends. Workflow
 * run files live at `subagents/workflows/<runId>/agent-*.jsonl` — three levels
 * down — and appends there do NOT bump ancestor dir mtimes, so the sweep must
 * reach the files themselves. The cap bounds traversal cost (and any symlink
 * cycles) on what are small session-artifact trees.
 */
const MAX_SWEEP_DEPTH = 5;

/**
 * Newest modification time (epoch ms) across the given paths — used as the
 * "last activity" signal for an agent. Both Claude Code and Codex append to
 * their transcript/rollout (and Claude writes subagent + tool-result files)
 * as work happens, so the freshest mtime among those files is a far better
 * liveness signal than parsing per-turn token-usage timestamps (which lag to
 * turn boundaries).
 *
 * - A file path contributes its own mtime.
 * - A directory path contributes the newest mtime in its subtree, down to
 *   MAX_SWEEP_DEPTH entry levels (deep enough for nested workflow run files
 *   under `subagents/workflows/<runId>/`).
 * - Missing/unreadable paths are skipped.
 *
 * Returns undefined when nothing is stat-able (caller treats that as "unknown"
 * → fail-safe: no idle override).
 */
export function newestMtime(paths: string[]): number | undefined {
  let newest: number | undefined;
  const consider = (m: number) => {
    if (newest === undefined || m > newest) newest = m;
  };
  const sweepDir = (p: string, depth: number) => {
    let entries: string[];
    try {
      entries = fs.readdirSync(p);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(p, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue; /* skip unreadable entry */
      }
      consider(st.mtimeMs);
      if (st.isDirectory() && depth > 1) sweepDir(full, depth - 1);
    }
  };
  for (const p of paths) {
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      sweepDir(p, MAX_SWEEP_DEPTH);
    } else {
      consider(st.mtimeMs);
    }
  }
  return newest;
}
