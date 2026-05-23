import fs from "fs";
import path from "path";
import type { RawSessionFile } from "./types";

export interface DiscoveredSession {
  pid: number;
  sessionId: string;
  cwd: string;
  status: "busy" | "idle";
  startedAt: number;
  updatedAt: number;
  entrypoint: string;
  version: string;
}

function isPidAliveDefault(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function discoverSessions(
  sessionsDir: string,
  isPidAlive: (pid: number) => boolean = isPidAliveDefault
): Promise<DiscoveredSession[]> {
  let files: string[];
  try {
    files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const sessions: DiscoveredSession[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const data: RawSessionFile = JSON.parse(raw);

      if (!isPidAlive(data.pid)) continue;

      sessions.push({
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        status: data.status,
        startedAt: data.startedAt,
        updatedAt: data.updatedAt,
        entrypoint: data.entrypoint,
        version: data.version,
      });
    } catch {
      continue;
    }
  }

  return sessions;
}

export function getTranscriptPath(
  projectsDir: string,
  cwd: string,
  sessionId: string
): string | null {
  const escaped = cwd.replace(/\//g, "-");
  const jsonlPath = path.join(projectsDir, escaped, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonlPath)) return jsonlPath;
  return null;
}
