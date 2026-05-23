"use client";

interface StatusBadgeProps {
  status: "busy" | "idle";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "busy"
          ? "bg-green-900/50 text-green-300"
          : "bg-gray-700/50 text-gray-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "busy" ? "bg-green-400 animate-pulse" : "bg-gray-500"
        }`}
      />
      {status === "busy" ? "Busy" : "Idle"}
    </span>
  );
}
