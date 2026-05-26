"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";

const AgentVilleScene = dynamic(
  () =>
    import("./AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export function BrowserPipContent() {
  useAgentStream();

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AgentVilleScene />
    </div>
  );
}
