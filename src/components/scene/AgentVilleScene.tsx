"use client";

import { useCallback, useMemo } from "react";
import { Container } from "pixi.js";
import { Application, extend } from "@pixi/react";
import { useTheme } from "next-themes";
import { useAgentStore } from "@/store/agents";
import { Tilemap } from "./Tilemap";
import { AgentSprite } from "./AgentSprite";
import { officeTheme } from "./themes/office";
import { farmTheme } from "./themes/farm";
import { workshopTheme } from "./themes/workshop";
import type { SceneTheme, AgentSlot } from "./themes/theme-types";
import type { Theme } from "@/store/agents";

extend({ Container });

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

export function AgentVilleScene() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const themeName = useAgentStore((s) => s.theme);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = THEMES[themeName];

  const agentList = Object.values(agents);

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

  const sceneWidth = dynamicTheme.gridCols * dynamicTheme.tileSize;
  const sceneHeight = dynamicTheme.gridRows * dynamicTheme.tileSize;

  return (
    <div className="w-full h-full flex items-center justify-center [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:object-contain [&_canvas]:[image-rendering:pixelated]">
      <Application
        width={sceneWidth}
        height={sceneHeight}
        background={isDark ? 0x1a1a2e : 0xe8e8f0}
        antialias={false}
        resolution={2}
      >
        <pixiContainer>
          <Tilemap theme={dynamicTheme} />
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
                onClick={handleAgentClick}
                onDoubleClick={handleAgentDoubleClick}
                isSelected={selectedAgentId === agent.sessionId}
                isDark={isDark}
                themeName={themeName}
              />
            );
          })}
        </pixiContainer>
      </Application>
    </div>
  );
}
