"use client";

import { useAgentStore } from "@/store/agents";
import { StatusBadge } from "./StatusBadge";
import { ActionList } from "./ActionList";

export function SidePanel() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const agent = selectedAgentId ? agents[selectedAgentId] : null;

  if (!agent) return null;

  const handleFocus = async () => {
    try {
      await fetch(`/api/agents/${agent.sessionId}/focus`, { method: "POST" });
    } catch {
      // focus failed silently
    }
  };

  const formatAction = (action: string): string => {
    if (action.startsWith("tool:")) return action.replace("tool:", "Using ");
    if (action === "thinking") return "Thinking...";
    if (action === "writing") return "Writing response...";
    return "Idle";
  };

  return (
    <div className="bg-gray-900 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white truncate">
            {agent.sessionId.slice(0, 8)}
          </h2>
          <button
            onClick={() => selectAgent(null)}
            className="text-gray-500 hover:text-white text-lg leading-none"
          >
            x
          </button>
        </div>
        <StatusBadge status={agent.status} />

        {agent.hostApp && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {agent.hostApp.name} — {shortenPath(agent.cwd)}
            </span>
            <button
              onClick={handleFocus}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
            >
              Focus
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
          Current Activity
        </h3>
        <p className="text-sm text-white">
          {formatAction(agent.currentAction)}
        </p>
      </div>

      <div className="p-4 border-b border-gray-800 flex-1 overflow-hidden">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Recent Actions
        </h3>
        <ActionList actions={agent.recentActions} />
      </div>

      {agent.subagents.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Subagents
          </h3>
          <ul className="space-y-1">
            {agent.subagents.map((sub) => (
              <li
                key={sub.sessionId}
                onClick={() => selectAgent(sub.sessionId)}
                className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white"
              >
                <StatusBadge status={sub.status} />
                <span className="truncate">{sub.sessionId.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Session Info
        </h3>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-300">
              {new Date(agent.startedAt).toLocaleTimeString()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Directory</dt>
            <dd className="text-gray-300 truncate ml-4">
              {shortenPath(agent.cwd)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">PID</dt>
            <dd className="text-gray-300">{agent.pid}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function shortenPath(p: string): string {
  const home =
    typeof window === "undefined" ? (process.env.HOME ?? "") : "";
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}
