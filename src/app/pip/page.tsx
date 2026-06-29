"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { usePip } from "@/hooks/usePip";
import { usePipExpand } from "@/hooks/usePipExpand";
import { PipHoverDebug } from "@/components/ui/PipHoverDebug";
import { PIP_SUPPRESS_COLLAPSE_EVENT } from "@/lib/pip-types";

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

  // The titlebar controls intentionally move focus off the PiP (show main / close),
  // which blurs this window. That is an in-PiP action, not a click-away, so tell
  // click-mode not to collapse on the resulting blur.
  const suppressCollapse = () => window.dispatchEvent(new Event(PIP_SUPPRESS_COLLAPSE_EVENT));

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
          >
            <button
              className="w-5 h-5 flex items-center justify-center text-xs rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              onClick={() => { suppressCollapse(); focusMain(); }}
              title="Show main window"
            >
              ↩
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center text-xs rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-colors"
              onClick={() => { suppressCollapse(); window.close(); }}
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
