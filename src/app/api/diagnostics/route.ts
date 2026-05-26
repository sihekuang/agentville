import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { getRegistry } from "@/lib/providers";

export async function GET(): Promise<NextResponse> {
  const home = process.env.HOME || os.homedir();
  const claudeHome = path.join(home, ".claude");
  const sessionsDir = path.join(claudeHome, "sessions");
  const projectsDir = path.join(claudeHome, "projects");

  const checks: Record<string, unknown> = {};

  checks.environment = {
    HOME: home,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT ?? "(not set)",
    pid: process.pid,
    uptime: `${Math.floor(process.uptime())}s`,
    nodeVersion: process.version,
  };

  checks.paths = {
    claudeHome: { path: claudeHome, exists: fs.existsSync(claudeHome) },
    sessionsDir: { path: sessionsDir, exists: fs.existsSync(sessionsDir) },
    projectsDir: { path: projectsDir, exists: fs.existsSync(projectsDir) },
  };

  let sessionFiles: string[] = [];
  try {
    sessionFiles = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
  } catch (err) {
    checks.sessionsError = (err as Error).message;
  }

  const sessions: Array<Record<string, unknown>> = [];
  for (const file of sessionFiles) {
    try {
      const raw = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const data = JSON.parse(raw);
      let pidAlive = false;
      try {
        process.kill(data.pid, 0);
        pidAlive = true;
      } catch {}

      const escaped = (data.cwd ?? "").replace(/\//g, "-");
      const transcriptPath = path.join(projectsDir, escaped, `${data.sessionId}.jsonl`);
      const transcriptExists = fs.existsSync(transcriptPath);

      sessions.push({
        file,
        pid: data.pid,
        pidAlive,
        sessionId: data.sessionId?.slice(0, 8),
        status: data.status,
        cwd: data.cwd,
        transcriptExists,
      });
    } catch (err) {
      sessions.push({ file, error: (err as Error).message });
    }
  }
  checks.sessions = sessions;

  try {
    const registry = getRegistry();
    const discovered = await registry.discoverAll();
    checks.discoveredAgents = discovered.map((a) => ({
      id: a.id.slice(0, 8),
      provider: a.provider,
      status: a.status,
      currentAction: a.currentAction,
      recentActivityCount: a.recentActivity.length,
      cwd: a.cwd,
    }));
  } catch (err) {
    checks.discoveryError = (err as Error).message;
  }

  return NextResponse.json(checks, {
    headers: { "Cache-Control": "no-cache" },
  });
}
