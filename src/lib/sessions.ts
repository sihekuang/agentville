import fs from "fs";
import path from "path";
import type { RawSessionFile } from "./types";

export interface DiscoveredSession {
  pid: number;
  sessionId: string;
  cwd: string;
  status: "busy" | "idle" | "waiting";
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
  } catch (err) {
    console.warn(`[agentville] cannot read sessions dir ${sessionsDir}:`, (err as Error).message);
    return [];
  }

  const sessions: DiscoveredSession[] = [];
  let deadCount = 0;

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const data: RawSessionFile = JSON.parse(raw);

      if (!isPidAlive(data.pid)) {
        deadCount++;
        continue;
      }

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
    } catch (err) {
      console.warn(`[agentville] failed to parse session file ${file}:`, (err as Error).message);
      continue;
    }
  }

  if (sessions.length > 0 || deadCount > 0) {
    console.log(`[agentville] sessions: ${sessions.length} alive, ${deadCount} dead, ${files.length} total files`);
  }

  return sessions;
}

export function getTranscriptPath(
  projectsDir: string,
  cwd: string,
  sessionId: string
): string | null {
  const escaped = cwd.replace(/[/.]/g, "-");
  const jsonlPath = path.join(projectsDir, escaped, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonlPath)) return jsonlPath;
  return null;
}
