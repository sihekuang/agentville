"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { useAgentStore } from "@/store/agents";
import { Header } from "./ui/Header";
import { SidePanel } from "./ui/SidePanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import type { PanelImperativeHandle } from "react-resizable-panels";

const AgentVilleScene = dynamic(
  () =>
    import("./scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export function AppShell() {
  useAgentStream();
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const sidePanelRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => {
    if (selectedAgentId) {
      sidePanelRef.current?.expand();
    } else {
      sidePanelRef.current?.collapse();
    }
  }, [selectedAgentId]);

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Header />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="65%" minSize="30%">
          <main className="flex items-center justify-center bg-gray-950 overflow-auto h-full">
            <AgentVilleScene />
          </main>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          panelRef={sidePanelRef}
          defaultSize="35%"
          minSize="20%"
          maxSize="60%"
          collapsible
          collapsedSize="0%"
        >
          <SidePanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
