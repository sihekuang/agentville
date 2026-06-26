"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { usePip } from "@/hooks/usePip";
import { usePipExpand } from "@/hooks/usePipExpand";
import { PipHoverDebug } from "@/components/ui/PipHoverDebug";

const AgentVilleScene = dynamic(
  () =>
    import("@/components/scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export default function PipPage() {
  useAgentStream();
  usePipExpand();
  const { backend, focusMain } = usePip();
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => setIsElectron(backend === "electron"), [backend]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-background relative">
      <PipHoverDebug />
      {isElectron && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-5 z-10"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <div
            className="absolute top-1 right-1 z-20 flex gap-1"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            // Keep click-to-expand from firing on the control buttons (avoids an
            // expand→collapse flash when clicking ↩/×, which then blur/close the window).
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              className="w-5 h-5 flex items-center justify-center text-xs rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              onClick={focusMain}
              title="Show main window"
            >
              ↩
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center text-xs rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-colors"
              onClick={() => window.close()}
              title="Close PIP"
            >
              ×
            </button>
          </div>
        </>
      )}
      <div className={`w-full h-full ${isElectron ? "pt-5" : ""}`}>
        <AgentVilleScene isPip />
      </div>
    </div>
  );
}
