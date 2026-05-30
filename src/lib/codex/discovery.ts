import { execFileSync } from "child_process";

export interface ScannedProcess {
  pid: number;
  rolloutPath: string;
  cwd: string;
}

export interface CodexProcess {
  pid: number;
  sessionId: string;
  rolloutPath: string;
  cwd: string;
}

export type CodexProcessScan = () => Promise<ScannedProcess[]>;

const SESSION_ID_RE = /rollout-[0-9TZ.-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

function extractSessionId(rolloutPath: string): string | null {
  const m = SESSION_ID_RE.exec(rolloutPath);
  return m ? m[1] : null;
}

/** Default scan: `pgrep -x codex` + `lsof -p <pid> -Fn` for each pid. */
export const defaultScan: CodexProcessScan = async () => {
  let pids: number[] = [];
  try {
    const out = execFileSync("pgrep", ["-x", "codex"], { encoding: "utf-8" }).trim();
    if (!out) return [];
    pids = out.split("\n").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
  } catch {
    // pgrep returns non-zero if no matches — that's not an error
    return [];
  }

  const out: ScannedProcess[] = [];
  for (const pid of pids) {
    let lsof = "";
    try {
      lsof = execFileSync("lsof", ["-p", String(pid), "-Fn"], { encoding: "utf-8" });
    } catch { continue; }

    // lsof -Fn emits one record per fd: 'f<fd>\n' followed by 'n<path>\n'.
    // The cwd record has fd 'cwd' (literal), and emits as 'fcwd' then 'n<path>'.
    // Other open files emit numeric fds like 'f31w' (for the rollout's write fd).
    // The parser below looks for any open path matching …/.codex/sessions/.*rollout-.*\.jsonl$.
    let rolloutPath = "";
    let cwd = "";
    let lastIsCwd = false;
    for (const line of lsof.split("\n")) {
      if (line.startsWith("f")) {
        lastIsCwd = line === "fcwd";
        continue;
      }
      if (line.startsWith("n")) {
        const p = line.slice(1);
        if (lastIsCwd && !cwd) cwd = p;
        else if (!rolloutPath && /\.codex\/sessions\/.*rollout-.*\.jsonl$/.test(p)) {
          rolloutPath = p;
        }
      }
    }
    if (rolloutPath && cwd) out.push({ pid, rolloutPath, cwd });
  }
  return out;
};

export async function discoverCodexProcesses(
  scan: CodexProcessScan = defaultScan
): Promise<CodexProcess[]> {
  const scanned = await scan();
  const out: CodexProcess[] = [];
  for (const s of scanned) {
    const sessionId = extractSessionId(s.rolloutPath);
    if (!sessionId) continue;
    out.push({ pid: s.pid, sessionId, rolloutPath: s.rolloutPath, cwd: s.cwd });
  }
  return out;
}
