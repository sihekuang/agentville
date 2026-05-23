import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { HostApp, RawIdeLock } from "./types";

interface AppIdentification {
  type: "terminal" | "ide";
  name: string;
}

const KNOWN_APPS: Record<string, AppIdentification> = {
  iTerm2: { type: "terminal", name: "iTerm2" },
  "iTerm2-arm64": { type: "terminal", name: "iTerm2" },
  Terminal: { type: "terminal", name: "Terminal" },
  Warp: { type: "terminal", name: "Warp" },
  Hyper: { type: "terminal", name: "Hyper" },
  Alacritty: { type: "terminal", name: "Alacritty" },
  kitty: { type: "terminal", name: "Kitty" },
  WezTerm: { type: "terminal", name: "WezTerm" },
  "Code Helper (Renderer)": { type: "ide", name: "VS Code" },
  "Cursor Helper (Renderer)": { type: "ide", name: "Cursor" },
};

export function identifyAppFromProcessName(
  name: string
): AppIdentification | null {
  return KNOWN_APPS[name] ?? null;
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

function getParentPids(pid: number): number[] {
  const pids: number[] = [];
  let currentPid = pid;

  for (let i = 0; i < 20; i++) {
    try {
      const ppid = parseInt(
        execSync(`ps -o ppid= -p ${currentPid}`, { encoding: "utf-8" }).trim(),
        10
      );
      if (isNaN(ppid) || ppid <= 1) break;
      pids.push(ppid);
      currentPid = ppid;
    } catch {
      break;
    }
  }

  return pids;
}

function getProcessName(pid: number): string | null {
  try {
    return execSync(`ps -o comm= -p ${pid}`, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
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

export function resolveHostApp(
  pid: number,
  cwd: string,
  sessionId: string,
  ideDir?: string
): HostApp | null {
  const cacheKey = sessionId;
  if (hostAppCache.has(cacheKey)) return hostAppCache.get(cacheKey)!;

  const ideLockDir =
    ideDir ?? path.join(process.env.HOME ?? "~", ".claude", "ide");
  const ideLocks = readIdeLockDir(ideLockDir);
  for (const lock of ideLocks) {
    if (lock.workspaceFolders.some((ws) => cwd.startsWith(ws))) {
      const result: HostApp = {
        type: "ide",
        name: lock.ideName,
        pid: lock.pid,
        cwd,
      };
      hostAppCache.set(cacheKey, result);
      return result;
    }
  }

  const parentPids = getParentPids(pid);
  for (const ppid of parentPids) {
    const processName = getProcessName(ppid);
    if (!processName) continue;

    const baseName = path.basename(processName);
    const app = identifyAppFromProcessName(baseName);
    if (app) {
      const result: HostApp = {
        type: app.type,
        name: app.name,
        pid: ppid,
        cwd,
      };
      hostAppCache.set(cacheKey, result);
      return result;
    }
  }

  hostAppCache.set(cacheKey, null);
  return null;
}

export function clearHostAppCache(): void {
  hostAppCache.clear();
}
