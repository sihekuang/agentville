import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { resolveHostApp } from "@/lib/host-app";
import { focusWindow } from "@/lib/focus-window";
import type { RawSessionFile } from "@/lib/types";

const CLAUDE_HOME = path.join(process.env.HOME ?? "~", ".claude");
const SESSIONS_DIR = path.join(CLAUDE_HOME, "sessions");

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await params;

  let sessionFile: RawSessionFile | null = null;
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    for (const file of files) {
      const raw = fs.readFileSync(
        path.join(SESSIONS_DIR, file),
        "utf-8"
      );
      const data: RawSessionFile = JSON.parse(raw);
      if (data.sessionId === sessionId) {
        sessionFile = data;
        break;
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to read sessions" },
      { status: 500 }
    );
  }

  if (!sessionFile) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const hostApp = resolveHostApp(
    sessionFile.pid,
    sessionFile.cwd,
    sessionId
  );

  if (!hostApp) {
    return NextResponse.json(
      { error: "Could not determine host application" },
      { status: 404 }
    );
  }

  const projectHint = path.basename(hostApp.cwd);

  let tty: string | null = null;
  try {
    const { execSync } = await import("child_process");
    tty = execSync(`ps -o tty= -p ${sessionFile.pid}`, {
      encoding: "utf-8",
      timeout: 2000,
    }).trim() || null;
    if (tty === "??") tty = null;
  } catch {
    // process may have exited
  }

  const result = focusWindow(hostApp, projectHint, sessionFile.pid);

  return NextResponse.json({
    success: result.success,
    windowTitle: result.windowTitle ?? null,
    method: result.windowTitle?.startsWith("warp://") ? "warp-focus-url" : result.windowTitle ? "window-match" : "bell",
    hostApp: { type: hostApp.type, name: hostApp.name },
    debug: {
      projectHint,
      tty,
      pid: sessionFile.pid,
      cwd: hostApp.cwd,
    },
  });
}
