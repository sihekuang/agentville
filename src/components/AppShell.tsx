"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Header } from "./ui/Header";
import { SidePanel } from "./ui/SidePanel";

const AgentVilleScene = dynamic(
  () =>
    import("./scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export function AppShell() {
  useAgentStream();

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex items-center justify-center bg-gray-950 overflow-auto">
          <AgentVilleScene />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
