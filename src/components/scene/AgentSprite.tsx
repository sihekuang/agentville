"use client";

import { useCallback } from "react";
import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { extend } from "@pixi/react";
import { useTexture } from "./use-texture";
import type { AgentAction } from "@/lib/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

extend({ Container, Sprite, Text });

interface AgentSpriteProps {
  x: number;
  y: number;
  sessionId: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
  animConfig: AgentAnimationConfig;
  onClick: (sessionId: string) => void;
  isSelected: boolean;
}

const labelStyle = new TextStyle({
  fontSize: 8,
  fill: 0xffffff,
  fontFamily: "monospace",
  align: "center",
});

const selectedLabelStyle = new TextStyle({
  fontSize: 8,
  fill: 0xffff00,
  fontFamily: "monospace",
  align: "center",
});

export function AgentSprite({
  x,
  y,
  sessionId,
  currentAction,
  status,
  animConfig,
  onClick,
  isSelected,
}: AgentSpriteProps) {
  const handleClick = useCallback(() => {
    onClick(sessionId);
  }, [onClick, sessionId]);

  const texture = useTexture(animConfig.src);

  const label = sessionId.slice(0, 6);
  const tint = status === "busy" ? 0xffffff : 0x888888;

  return (
    <pixiContainer x={x} y={y}>
      {texture && (
        <pixiSprite
          texture={texture}
          width={animConfig.frameWidth}
          height={animConfig.frameHeight}
          anchor={0.5}
          tint={tint}
          eventMode="static"
          cursor="pointer"
          onPointerDown={handleClick}
        />
      )}
      <pixiText
        text={label}
        style={isSelected ? selectedLabelStyle : labelStyle}
        anchor={0.5}
        y={animConfig.frameHeight / 2 + 6}
      />
      {status === "busy" && (
        <pixiText
          text={formatAction(currentAction)}
          style={labelStyle}
          anchor={0.5}
          y={-(animConfig.frameHeight / 2 + 4)}
        />
      )}
    </pixiContainer>
  );
}

function formatAction(action: AgentAction): string {
  switch (action) {
    case "thinking":
      return "\u{1F4AD}";
    case "tool:Read":
      return "\u{1F4D6}";
    case "tool:Edit":
      return "✏️";
    case "tool:Bash":
      return "⚡";
    case "tool:Write":
      return "\u{1F4DD}";
    case "tool:Agent":
      return "\u{1F916}";
    case "tool:other":
      return "\u{1F527}";
    case "writing":
      return "\u{1F4AC}";
    case "idle":
      return "";
  }
}
