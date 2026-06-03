"use client";

interface StatusBadgeProps {
  status: "busy" | "idle" | "waiting" | "stalled";
  /** Optional hover explanation (used for the "stalled" reason). */
  title?: string;
}

export function StatusBadge({ status, title }: StatusBadgeProps) {
  const isActive = status === "busy" || status === "waiting";
  const isStalled = status === "stalled";
  const label =
    status === "busy" ? "Busy" : status === "waiting" ? "Waiting" : isStalled ? "Stalled" : "Idle";

  const pillClass = isStalled
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : isActive
      ? "bg-green-500/15 text-green-700 dark:text-green-300"
      : "bg-muted text-muted-foreground";

  const dotClass = isStalled
    ? "bg-amber-500 dark:bg-amber-400"
    : isActive
      ? "bg-green-500 dark:bg-green-400 animate-pulse"
      : "bg-muted-foreground/50";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${pillClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
