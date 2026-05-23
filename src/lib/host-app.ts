import fs from "fs";
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

  const platform = getPlatform();
  const parentPids = platform.getParentPids(pid);
  for (const ppid of parentPids) {
    const processName = platform.getProcessName(ppid);
    if (!processName) continue;

    const app = identifyAppFromProcessName(processName);
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

  return null;
}

export function clearHostAppCache(): void {
  hostAppCache.clear();
}
