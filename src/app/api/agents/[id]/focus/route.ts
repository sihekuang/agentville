import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { execSync } from "child_process";
import { getRegistry } from "@/lib/providers";
import { parseAgentId } from "@/lib/providers/types";
import { focusWindow } from "@/lib/focus-window";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawParam } = await params;
  const id = decodeURIComponent(rawParam);

  const parsed = parseAgentId(id);
  if (!parsed) {
    return NextResponse.json({ error: "Malformed agent id" }, { status: 400 });
  }

  const provider = getRegistry().getByName(parsed.provider);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider '${parsed.provider}'` },
      { status: 404 }
    );
  }

  const agents = await provider.discoverAgents();
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (!agent.hostApp) {
    return NextResponse.json(
      { error: "Could not determine host application" },
      { status: 404 }
    );
  }

  const projectHint = path.basename(agent.cwd);

  let tty: string | null = null;
  try {
    tty = execSync(`ps -o tty= -p ${agent.pid}`, {
      encoding: "utf-8",
      timeout: 2000,
    }).trim() || null;
    if (tty === "??") tty = null;
  } catch {
    // process may have exited
  }

  const result = focusWindow(agent.hostApp, projectHint, agent.pid);

  return NextResponse.json({
    success: result.success,
    windowTitle: result.windowTitle ?? null,
    method: result.windowTitle?.startsWith("warp://")
      ? "warp-focus-url"
      : result.windowTitle
        ? "window-match"
        : "bell",
    hostApp: { type: agent.hostApp.type, name: agent.hostApp.name },
    debug: { projectHint, tty, pid: agent.pid, cwd: agent.hostApp.cwd },
  });
}
