"use client";

interface StatusBadgeProps {
  status: "busy" | "idle" | "waiting";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === "busy" || status === "waiting";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-500/15 text-green-700 dark:text-green-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-green-500 dark:bg-green-400 animate-pulse" : "bg-muted-foreground/50"
        }`}
      />
      {status === "busy" ? "Busy" : status === "waiting" ? "Waiting" : "Idle"}
    </span>
  );
}
