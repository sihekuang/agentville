"use client";

import { useCallback } from "react";
import { Container } from "pixi.js";
import { Application, extend } from "@pixi/react";
import { useAgentStore } from "@/store/agents";
import { Tilemap } from "./Tilemap";
import { AgentSprite } from "./AgentSprite";
import { officeTheme } from "./themes/office";
import { farmTheme } from "./themes/farm";
import { workshopTheme } from "./themes/workshop";
import type { SceneTheme } from "./themes/theme-types";
import type { Theme } from "@/store/agents";

extend({ Container });

const THEMES: Record<Theme, SceneTheme> = {
  office: officeTheme,
  farm: farmTheme,
  workshop: workshopTheme,
};

export function AgentVilleScene() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const themeName = useAgentStore((s) => s.theme);
  const theme = THEMES[themeName];

  const agentList = Object.values(agents);

  const handleAgentClick = useCallback(
    (sessionId: string) => {
      selectAgent(selectedAgentId === sessionId ? null : sessionId);
    },
    [selectAgent, selectedAgentId],
  );

  const sceneWidth = theme.gridCols * theme.tileSize;
  const sceneHeight = theme.gridRows * theme.tileSize;

  return (
    <Application
      width={sceneWidth}
      height={sceneHeight}
      background={0x1a1a2e}
      antialias={false}
      resolution={2}
    >
      <pixiContainer>
        <Tilemap theme={theme} />
        {agentList.map((agent, index) => {
          const slot = theme.agentSlots[index % theme.agentSlots.length];
          return (
            <AgentSprite
              key={agent.sessionId}
              x={slot.x * theme.tileSize}
              y={slot.y * theme.tileSize}
              sessionId={agent.sessionId}
              currentAction={agent.currentAction}
              status={agent.status}
              animConfig={theme.agent}
              onClick={handleAgentClick}
              isSelected={selectedAgentId === agent.sessionId}
            />
          );
        })}
      </pixiContainer>
    </Application>
  );
}
