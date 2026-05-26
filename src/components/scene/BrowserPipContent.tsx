"use client";

import { Suspense, lazy } from "react";
import { useAgentStream } from "@/hooks/use-agent-stream";

// Use React.lazy instead of next/dynamic — this component runs in a
// standalone React root (Document PIP window), not inside Next.js.
const AgentVilleScene = lazy(() =>
  import("./AgentVilleScene").then((m) => ({ default: m.AgentVilleScene }))
);

export function BrowserPipContent() {
  useAgentStream();

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Suspense fallback={null}>
        <AgentVilleScene />
      </Suspense>
    </div>
  );
}
