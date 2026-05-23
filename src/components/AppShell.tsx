"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Header } from "./ui/Header";
import { SidePanel } from "./ui/SidePanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";

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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="65%" minSize="30%">
          <main className="bg-background h-full overflow-hidden p-4">
            <AgentVilleScene />
          </main>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="35%"
          minSize="20%"
          maxSize="60%"
        >
          <SidePanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
