"use client";

import type { TranscriptEntry } from "@/lib/types";

interface ActionListProps {
  actions: TranscriptEntry[];
}

export function ActionList({ actions }: ActionListProps) {
  if (actions.length === 0) {
    return <p className="text-gray-500 text-sm italic">No activity yet</p>;
  }

  return (
    <ul className="space-y-1 max-h-64 overflow-y-auto">
      {[...actions].reverse().map((action, i) => (
        <li key={i} className="flex gap-2 text-xs font-mono">
          <span className="text-gray-500 shrink-0">
            {formatTime(action.timestamp)}
          </span>
          <span className="text-gray-300 truncate">{action.summary}</span>
        </li>
      ))}
    </ul>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
