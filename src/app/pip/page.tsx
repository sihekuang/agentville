"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";

const AgentVilleScene = dynamic(
  () =>
    import("@/components/scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export default function PipPage() {
  useAgentStream();

  // Defer Electron detection to after hydration to avoid mismatch
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    if ("electronAPI" in window) setIsElectron(true);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-background relative">
      {isElectron && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-5 z-10"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <button
            className="absolute top-1 right-2 z-20 w-4 h-4 flex items-center justify-center text-xs rounded-full text-muted-foreground opacity-0 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={() => window.close()}
          >
            ×
          </button>
        </>
      )}
      <div className={`w-full h-full ${isElectron ? "pt-5" : ""}`}>
        <AgentVilleScene isPip />
      </div>
    </div>
  );
}
