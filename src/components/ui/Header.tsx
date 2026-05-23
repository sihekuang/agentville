"use client";

import { useAgentStore, type Theme } from "@/store/agents";
import { ModeToggle } from "./ModeToggle";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "farm", label: "Farm" },
  { value: "workshop", label: "Workshop" },
];

export function Header() {
  const agents = useAgentStore((s) => s.agents);
  const theme = useAgentStore((s) => s.theme);
  const setTheme = useAgentStore((s) => s.setTheme);

  const agentList = Object.values(agents);
  const busyCount = agentList.filter((a) => a.status === "busy").length;
  const idleCount = agentList.filter((a) => a.status === "idle").length;

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          AgentVille
        </h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{agentList.length} agents</span>
          <span className="text-green-500 dark:text-green-400">{busyCount} busy</span>
          <span className="text-muted-foreground">{idleCount} idle</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`px-3 py-1 text-xs rounded ${
                theme === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
