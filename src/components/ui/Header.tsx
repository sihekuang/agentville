"use client";

import { useAgentStore, type Theme } from "@/store/agents";
import { ModeToggle } from "./ModeToggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "farm", label: "Farm" },
  { value: "workshop", label: "Workshop" },
];

export const ACTIVITY_LEGEND: { emoji: string; label: string }[] = [
  { emoji: "💭", label: "Thinking" },
  { emoji: "💬", label: "Writing" },
  { emoji: "📖", label: "Reading files" },
  { emoji: "✏️", label: "Editing files" },
  { emoji: "📝", label: "Writing files" },
  { emoji: "⚡", label: "Running commands" },
  { emoji: "🤖", label: "Spawning sub-agent" },
  { emoji: "🔧", label: "Using other tools" },
  { emoji: "💤", label: "Idle (zzz)" },
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
        <Popover>
          <PopoverTrigger
            className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground text-xs cursor-pointer"
            aria-label="About AgentVille"
          >
            ?
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-foreground mb-1">About</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AgentVille visualizes your running Claude Code sessions in
                  real-time. Each character represents an active agent — click
                  one to see its recent activity.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Activity Legend</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {ACTIVITY_LEGEND.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-5 text-center text-sm">{item.emoji}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Busy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                    Idle (dimmed)
                  </span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
