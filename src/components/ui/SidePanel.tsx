"use client";

import { useState } from "react";
import { useAgentStore } from "@/store/agents";
import { StatusBadge } from "./StatusBadge";
import { ActionList } from "./ActionList";
import { ACTIVITY_LEGEND } from "./Header";

interface FocusDebugInfo {
  success: boolean;
  windowTitle: string | null;
  method: string;
  hostApp: { type: string; name: string };
  debug: {
    projectHint: string;
    tty: string | null;
    pid: number;
    cwd: string;
  };
}

export function SidePanel() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const idleTimeoutMs = useAgentStore((s) => s.idleTimeoutMs);
  const setIdleTimeoutMs = useAgentStore((s) => s.setIdleTimeoutMs);
  const [focusInfo, setFocusInfo] = useState<FocusDebugInfo | null>(null);

  const agent = selectedAgentId ? agents[selectedAgentId] : null;

  if (!agent) {
    return (
      <div className="bg-card flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">AgentVille</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Click an agent to see its activity.
            <br />
            Double-click to focus its window.
          </p>
        </div>
        <div className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Activity Legend
          </h3>
          <div className="space-y-2">
            {ACTIVITY_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-foreground">
                <span className="w-6 text-center text-base">{item.emoji}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-border mt-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Status Indicators
          </h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Busy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
              Idle (dimmed)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
              Stalled (auto-idle)
            </span>
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Idle Timeout
          </h3>
          <select
            value={idleTimeoutMs}
            onChange={(e) => setIdleTimeoutMs(Number(e.target.value))}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
            <option value={600000}>10 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={0}>Off</option>
          </select>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Treat an agent as idle after this long with no activity, even if it still reports busy.
          </p>
        </div>
      </div>
    );
  }

  const handleFocus = async () => {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/focus`, { method: "POST" });
      const data = await res.json();
      setFocusInfo(data);
    } catch {
      setFocusInfo(null);
    }
  };

  const formatAction = (action: string): string => {
    switch (action) {
      case "thinking": return "Thinking...";
      case "reading": return "Using Read";
      case "editing": return "Using Edit";
      case "executing": return "Using Bash";
      case "writing": return "Writing response...";
      case "delegating": return "Using Agent";
      case "other": return "Using tool";
      case "waiting": return "Waiting...";
      case "idle": return "Idle";
      default: return action;
    }
  };

  return (
    <div className="bg-card flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-mono font-bold text-foreground break-all select-all leading-tight mr-2">
            {agent.id}
          </h2>
          <button
            onClick={() => selectAgent(null)}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            x
          </button>
        </div>
        <StatusBadge status={agent.status} />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {agent.hostApp
              ? `${agent.hostApp.name} — ${shortenPath(agent.cwd)}`
              : `Unknown host — ${shortenPath(agent.cwd)}`}
          </span>
          <button
            onClick={handleFocus}
            disabled={!agent.hostApp}
            className={`text-xs px-2 py-1 rounded ${
              agent.hostApp
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Focus
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
          Current Activity
        </h3>
        <p className="text-sm text-foreground">
          {formatAction(agent.currentAction)}
        </p>
      </div>

      <div className="p-4 border-b border-border flex-1 overflow-hidden">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Recent Actions
        </h3>
        <ActionList actions={agent.recentActivity} />
      </div>

      {agent.subagents.length > 0 && (
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Subagents
          </h3>
          <ul className="space-y-1">
            {agent.subagents.map((sub) => (
              <li
                key={sub.id}
                onClick={() => selectAgent(sub.id)}
                className="flex items-center gap-2 text-xs text-secondary-foreground cursor-pointer hover:text-foreground"
              >
                <StatusBadge status={sub.status} />
                <span className="truncate">{sub.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Session Info
        </h3>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Started</dt>
            <dd className="text-secondary-foreground" title={new Date(agent.startedAt).toLocaleString()}>
              {formatRelativeTime(agent.startedAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Directory</dt>
            <dd
              className="text-primary hover:text-primary/80 truncate ml-4 cursor-pointer"
              title={agent.cwd}
              onClick={() => {
                fetch("/api/open-directory", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: agent.cwd }),
                }).catch(() => {});
              }}
            >
              {shortenPath(agent.cwd)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">PID</dt>
            <dd className="text-secondary-foreground">{agent.pid}</dd>
          </div>
        </dl>
      </div>

      {focusInfo && (
        <div className="p-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Focus Debug
          </h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Result</dt>
              <dd className={focusInfo.success ? "text-green-500" : "text-destructive"}>
                {focusInfo.success ? "OK" : "Failed"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Method</dt>
              <dd className="text-secondary-foreground">{focusInfo.method}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Host App</dt>
              <dd className="text-secondary-foreground">
                {focusInfo.hostApp.name} ({focusInfo.hostApp.type})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">TTY</dt>
              <dd className="text-secondary-foreground font-mono">
                {focusInfo.debug.tty ?? "none"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Project Hint</dt>
              <dd className="text-secondary-foreground">{focusInfo.debug.projectHint}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">PID</dt>
              <dd className="text-secondary-foreground font-mono">{focusInfo.debug.pid}</dd>
            </div>
            {focusInfo.windowTitle && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Window</dt>
                <dd className="text-secondary-foreground truncate ml-4">{focusInfo.windowTitle}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function shortenPath(p: string): string {
  const home =
    typeof window === "undefined" ? (process.env.HOME ?? "") : "";
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}
