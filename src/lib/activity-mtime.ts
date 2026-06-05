import fs from "fs";
import path from "path";

/**
 * Newest modification time (epoch ms) across the given paths — used as the
 * "last activity" signal for an agent. Both Claude Code and Codex append to
 * their transcript/rollout (and Claude writes subagent + tool-result files)
 * as work happens, so the freshest mtime among those files is a far better
 * liveness signal than parsing per-turn token-usage timestamps (which lag to
 * turn boundaries).
 *
 * - A file path contributes its own mtime.
 * - A directory path contributes the newest mtime among its immediate entries
 *   (one level — enough for `subagents/` and `tool-results/`, which hold files).
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
  for (const p of paths) {
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      let entries: string[];
      try {
        entries = fs.readdirSync(p);
      } catch {
        continue;
      }
      for (const name of entries) {
        try {
          consider(fs.statSync(path.join(p, name)).mtimeMs);
        } catch {
          /* skip unreadable entry */
        }
      }
    } else {
      consider(st.mtimeMs);
    }
  }
  return newest;
}
