"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Container, type Texture } from "pixi.js";
import { Application, extend, useApplication } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { useTheme } from "next-themes";
import { useAgentStore, type TrackedAgent } from "@/store/agents";
import { usePip } from "@/hooks/usePip";
import { useLoadTexture } from "./use-animation-frames";
import { Tilemap } from "./Tilemap";
import { AgentSprite } from "./AgentSprite";
import { officeTheme } from "./themes/office";
import { farmTheme } from "./themes/farm";
import { workshopTheme } from "./themes/workshop";
import type { SceneTheme, AgentSlot } from "./themes/theme-types";
import type { Theme } from "@/store/agents";

extend({ Container, Viewport });

const THEMES: Record<Theme, SceneTheme> = {
  office: officeTheme,
  farm: farmTheme,
  workshop: workshopTheme,
};

const CELL_W = 3;
const CELL_H = 3;
const PAD = 1;
const MIN_COLS = 3;
const MIN_ROWS = 2;

function computeLayout(agentCount: number) {
  const n = Math.max(agentCount, 1);
  const cols = Math.max(MIN_COLS, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.max(MIN_ROWS, Math.ceil(n / cols));
  const gridCols = cols * CELL_W + PAD * 2;
  const gridRows = rows * CELL_H + PAD * 2;

  const slots: AgentSlot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: PAD + c * CELL_W + Math.floor(CELL_W / 2),
        y: PAD + r * CELL_H + Math.floor(CELL_H / 2),
      });
    }
  }

  return { gridCols, gridRows, slots };
}

const SCREEN_W = 800;
const SCREEN_H = 600;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

interface SceneContentProps {
  dynamicTheme: SceneTheme;
  agentList: TrackedAgent[];
  selectedAgentId: string | null;
  spriteTexture: Texture | null;
  handleAgentClick: (id: string) => void;
  handleAgentDoubleClick: (id: string) => void;
  isDark: boolean;
  themeName: string;
  onViewportReady: (vp: Viewport) => void;
}

function SceneContent({
  dynamicTheme,
  agentList,
  selectedAgentId,
  spriteTexture,
  handleAgentClick,
  handleAgentDoubleClick,
  isDark,
  themeName,
  onViewportReady,
}: SceneContentProps) {
  const { app, isInitialised } = useApplication();
  const viewportRef = useRef<Viewport | null>(null);
  const containerRef = useRef<Container>(null);
  const innerRef = useRef<Container>(null);

  const worldW = dynamicTheme.gridCols * dynamicTheme.tileSize;
  const worldH = dynamicTheme.gridRows * dynamicTheme.tileSize;

  useEffect(() => {
    if (!isInitialised || !containerRef.current || !innerRef.current) return;

    if (viewportRef.current) {
      viewportRef.current.destroy({ children: false });
      viewportRef.current = null;
    }

    const vp = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: worldW,
      worldHeight: worldH,
      events: app.renderer.events,
    });

    vp.drag()
      .pinch()
      .wheel({ smooth: 3, wheelZoom: true })
      .decelerate({ friction: 0.9 })
      .clampZoom({ minScale: MIN_SCALE, maxScale: MAX_SCALE });

    // Prevent browser default scroll on the canvas so wheel events reach pixi-viewport
    const canvas = app.canvas as HTMLCanvasElement;
    const preventScroll = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", preventScroll, { passive: false });
    vp.once("destroyed", () => canvas.removeEventListener("wheel", preventScroll));

    vp.fit(true, worldW, worldH);
    vp.moveCenter(worldW / 2, worldH / 2);

    vp.addChild(innerRef.current);
    app.stage.addChild(vp);

    // Re-fit viewport when app resizes
    const onResize = () => {
      vp.resize(app.screen.width, app.screen.height, worldW, worldH);
      vp.fit(true, worldW, worldH);
      vp.moveCenter(worldW / 2, worldH / 2);
    };
    app.renderer.on("resize", onResize);

    viewportRef.current = vp;
    onViewportReady(vp);

    return () => {
      app.renderer?.off("resize", onResize);
      if (innerRef.current && vp.children.includes(innerRef.current)) {
        vp.removeChild(innerRef.current);
      }
      vp.destroy({ children: false });
      viewportRef.current = null;
    };
  }, [app, isInitialised, worldW, worldH, onViewportReady]);

  // When React adds new children (e.g. a new AgentSprite) to containerRef but
  // worldW/worldH haven't changed, the viewport effect doesn't re-run, leaving
  // the new child outside the viewport (rendered at raw world coords). This
  // effect sweeps any stranded children into the viewport after every render.
  useEffect(() => {
    const vp = viewportRef.current;
    const parent = containerRef.current;
    if (!vp || !parent) return;
    while (parent.children.length > 0) {
      vp.addChild(parent.children[0]);
    }
  });

  if (!isInitialised) return null;

  return (
    <pixiContainer ref={containerRef}>
      <pixiContainer ref={innerRef}>
        <Tilemap theme={dynamicTheme} agentCount={agentList.length} />
        {agentList.map((agent, index) => {
          const slot = dynamicTheme.agentSlots[index % dynamicTheme.agentSlots.length];
          return (
            <AgentSprite
              key={agent.sessionId}
              x={slot.x * dynamicTheme.tileSize}
              y={slot.y * dynamicTheme.tileSize}
              sessionId={agent.sessionId}
              cwd={agent.cwd}
              currentAction={agent.currentAction}
              status={agent.status}
              animConfig={dynamicTheme.agent}
              baseTexture={spriteTexture}
              onClick={handleAgentClick}
              onDoubleClick={handleAgentDoubleClick}
              isSelected={selectedAgentId === agent.sessionId}
              isDark={isDark}
              themeName={themeName}
            />
          );
        })}
      </pixiContainer>
    </pixiContainer>
  );
}

export function AgentVilleScene({ isPip = false }: { isPip?: boolean }) {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const themeName = useAgentStore((s) => s.theme);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = THEMES[themeName];
  const spriteTexture = useLoadTexture(theme.agent.src);

  const agentList = Object.values(agents).sort((a, b) =>
    a.sessionId.localeCompare(b.sessionId),
  );
  const viewportInstanceRef = useRef<Viewport>(null);

  const layout = useMemo(
    () => computeLayout(agentList.length),
    [agentList.length],
  );

  const dynamicTheme = useMemo(
    () => ({
      ...theme,
      gridCols: layout.gridCols,
      gridRows: layout.gridRows,
      agentSlots: layout.slots,
    }),
    [theme, layout],
  );

  const handleAgentClick = useCallback(
    (sessionId: string) => {
      selectAgent(selectedAgentId === sessionId ? null : sessionId);
    },
    [selectAgent, selectedAgentId],
  );

  const handleAgentDoubleClick = useCallback((sessionId: string) => {
    fetch(`/api/agents/${sessionId}/focus`, { method: "POST" }).catch(() => {});
  }, []);

  const handleViewportReady = useCallback((vp: Viewport) => {
    (viewportInstanceRef as React.MutableRefObject<Viewport | null>).current = vp;
  }, []);

  const handleFitAll = useCallback(() => {
    const vp = viewportInstanceRef.current;
    if (!vp) return;
    const worldW = dynamicTheme.gridCols * dynamicTheme.tileSize;
    const worldH = dynamicTheme.gridRows * dynamicTheme.tileSize;
    vp.fit(true, worldW, worldH);
    vp.moveCenter(worldW / 2, worldH / 2);
  }, [dynamicTheme]);

  const handleZoomIn = useCallback(() => {
    const vp = viewportInstanceRef.current;
    if (!vp) return;
    vp.zoom(-vp.worldScreenWidth * 0.2, true);
  }, []);

  const handleZoomOut = useCallback(() => {
    const vp = viewportInstanceRef.current;
    if (!vp) return;
    vp.zoom(vp.worldScreenWidth * 0.2, true);
  }, []);

  const containerDivRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);

  useEffect(() => {
    if (containerDivRef.current) setContainerReady(true);
  }, []);

  return (
    <div
      ref={containerDivRef}
      className="relative w-full h-full [&_canvas]:[image-rendering:pixelated]"
    >
      {containerReady && containerDivRef.current && (
        <Application
          background={isDark ? 0x1a1a2e : 0xe8e8f0}
          antialias={false}
          roundPixels
          resizeTo={containerDivRef.current}
          autoDensity
        >
        <SceneContent
          dynamicTheme={dynamicTheme}
          agentList={agentList}
          selectedAgentId={selectedAgentId}
          spriteTexture={spriteTexture}
          handleAgentClick={handleAgentClick}
          handleAgentDoubleClick={handleAgentDoubleClick}
          isDark={isDark}
          themeName={themeName}
          onViewportReady={handleViewportReady}
        />
      </Application>
      )}
      <div className="absolute bottom-3 right-3 flex gap-1">
        {!isPip && <PipButton />}
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={handleFitAll}
          className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          title="Fit all agents in view"
        >
          ⊡
        </button>
      </div>
    </div>
  );
}

function PipButton() {
  const { supported, activate } = usePip();
  if (!supported) return null;
  return (
    <button
      onClick={activate}
      className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
      title="Picture in Picture"
    >
      ⧉
    </button>
  );
}
