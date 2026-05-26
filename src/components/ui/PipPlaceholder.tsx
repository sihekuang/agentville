"use client";

interface PipPlaceholderProps {
  onRedock: () => void;
}

export function PipPlaceholder({ onRedock }: PipPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-muted text-muted-foreground">
      <p className="text-lg font-medium">Canvas is floating</p>
      <button
        onClick={onRedock}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Re-dock
      </button>
    </div>
  );
}
