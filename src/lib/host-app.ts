import fs from "fs";
import os from "os";
import path from "path";
import type { HostApp, RawIdeLock } from "./types";
import { getPlatform } from "./platform";

interface AppIdentification {
  type: "terminal" | "ide";
  name: string;
}

const KNOWN_IDES = new Set([
  "VS Code", "Cursor", "IntelliJ IDEA", "WebStorm", "PyCharm",
  "GoLand", "RubyMine", "CLion", "Rider", "PhpStorm", "Xcode",
]);

function extractAppName(processPath: string): string | null {
  const match = processPath.match(/\/([^/]+)\.app\//);
  return match ? match[1] : null;
}

export function identifyAppFromProcessName(
  processPath: string
): AppIdentification | null {
  const appName = extractAppName(processPath);
  if (!appName) return null;

  return {
    type: KNOWN_IDES.has(appName) ? "ide" : "terminal",
    name: appName,
  };
}

interface IdeLockEntry {
  port: number;
  content: string;
}

export function parseIdeLockFiles(entries: IdeLockEntry[]): RawIdeLock[] {
  const results: RawIdeLock[] = [];
  for (const entry of entries) {
    try {
      const data: RawIdeLock = JSON.parse(entry.content);
      results.push(data);
    } catch {
      continue;
    }
  }
  return results;
}

function readIdeLockDir(ideDir: string): RawIdeLock[] {
  try {
    const files = fs.readdirSync(ideDir).filter((f) => f.endsWith(".lock"));
    return parseIdeLockFiles(
      files.map((f) => ({
        port: parseInt(f.replace(".lock", ""), 10),
        content: fs.readFileSync(path.join(ideDir, f), "utf-8"),
      }))
    );
  } catch {
    return [];
  }
}

const hostAppCache = new Map<string, HostApp | null>();

/**
 * Side-effecting lookups, injected so resolution is unit-testable without
 * real processes. Default to the platform strategy in production.
 */
export interface HostAppDeps {
  getParentPids: (pid: number) => number[];
  getProcessName: (pid: number) => string | null;
}

export function resolveHostApp(
  pid: number,
  cwd: string,
  sessionId: string,
  ideDir?: string,
  deps?: HostAppDeps
): HostApp | null {
  const cacheKey = sessionId;
  if (hostAppCache.has(cacheKey)) return hostAppCache.get(cacheKey)!;

  const platform = getPlatform();
  const getParentPids = deps?.getParentPids ?? ((p) => platform.getParentPids(p));
  const getProcessName = deps?.getProcessName ?? ((p) => platform.getProcessName(p));

  // The session's actual ancestry is ground truth for where it runs. Compute it
  // once and use it both to validate IDE locks and to scan for terminals/IDEs.
  const parentPids = getParentPids(pid);

  const ideLockDir =
    ideDir ?? path.join(process.env.HOME || os.homedir(), ".claude", "ide");
  const ideLocks = readIdeLockDir(ideLockDir);

  const ownsCwd = (lock: RawIdeLock) =>
    lock.workspaceFolders.some((ws) => cwd.startsWith(ws));

  const cache = (result: HostApp): HostApp => {
    hostAppCache.set(cacheKey, result);
    return result;
  };

  // 1. Trust an IDE lock only when the session genuinely descends from that IDE.
  //    A lock means "this IDE has the folder open" — NOT "this session runs in
  //    it". Matching on cwd alone wrongly claims sessions started in a separate
  //    terminal (e.g. Warp) that happen to sit under an IDE's workspace folder.
  for (const lock of ideLocks) {
    if (ownsCwd(lock) && parentPids.includes(lock.pid)) {
      return cache({ type: "ide", name: lock.ideName, pid: lock.pid, cwd });
    }
  }

  // 2. Walk the parent-process chain for a known terminal or IDE. This is where
  //    a standalone-terminal session (Warp, iTerm, …) is correctly identified.
  for (const ppid of parentPids) {
    const processName = getProcessName(ppid);
    if (!processName) continue;

    const app = identifyAppFromProcessName(processName);
    if (app) {
      return cache({ type: app.type, name: app.name, pid: ppid, cwd });
    }
  }

  // 3. Last resort: if the chain revealed no recognizable host (e.g. the session
  //    was re-parented to init), fall back to an IDE that has the folder open.
  for (const lock of ideLocks) {
    if (ownsCwd(lock)) {
      return cache({ type: "ide", name: lock.ideName, pid: lock.pid, cwd });
    }
  }

  return null;
}

export function clearHostAppCache(): void {
  hostAppCache.clear();
}
