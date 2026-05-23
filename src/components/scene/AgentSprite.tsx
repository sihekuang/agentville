"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import { Container, Rectangle, Sprite, Text, TextStyle } from "pixi.js";
import { extend, useTick } from "@pixi/react";
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

const emoteStyle = new TextStyle({
  fontSize: 10,
  fill: 0xffffff,
  fontFamily: "sans-serif",
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

  const hitArea = useMemo(
    () => new Rectangle(
      -animConfig.frameWidth / 2 - 4,
      -animConfig.frameHeight / 2 - 4,
      animConfig.frameWidth + 8,
      animConfig.frameHeight + 20,
    ),
    [animConfig.frameWidth, animConfig.frameHeight],
  );

  const timeRef = useRef(Math.random() * Math.PI * 2);
  const [bobY, setBobY] = useState(0);
  const [emoteY, setEmoteY] = useState(0);
  const [emoteAlpha, setEmoteAlpha] = useState(1);
  const [zzzPhase, setZzzPhase] = useState(0);

  useTick((ticker) => {
    const dt = ticker.deltaTime / 60;
    timeRef.current += dt;
    const t = timeRef.current;

    if (status === "busy") {
      setBobY(Math.sin(t * 3) * 1.5);
      setEmoteY(-animConfig.frameHeight / 2 - 6 + Math.sin(t * 2) * 3);
      setEmoteAlpha(0.7 + Math.sin(t * 4) * 0.3);
    } else {
      setBobY(Math.sin(t * 0.8) * 0.5);
      setZzzPhase(t);
    }
  });

  const label = sessionId.slice(0, 6);
  const tint = status === "busy" ? 0xffffff : 0x888888;
  const emote = formatAction(currentAction);

  return (
    <pixiContainer
      x={x}
      y={y + bobY}
      eventMode="static"
      cursor="pointer"
      onPointerDown={handleClick}
      hitArea={hitArea}
    >
      {texture && (
        <pixiSprite
          texture={texture}
          width={animConfig.frameWidth}
          height={animConfig.frameHeight}
          anchor={0.5}
          tint={tint}
        />
      )}
      <pixiText
        text={label}
        style={isSelected ? selectedLabelStyle : labelStyle}
        anchor={0.5}
        y={animConfig.frameHeight / 2 + 6}
      />
      {status === "busy" && emote && (
        <pixiText
          text={emote}
          style={emoteStyle}
          anchor={0.5}
          y={emoteY}
          alpha={emoteAlpha}
        />
      )}
      {status === "idle" && (
        <>
          <pixiText
            text="z"
            style={new TextStyle({ fontSize: 6, fill: 0x8888cc, fontFamily: "monospace" })}
            anchor={0.5}
            x={8}
            y={-animConfig.frameHeight / 2 - 2 + Math.sin(zzzPhase * 1.2) * 2}
            alpha={0.4 + Math.sin(zzzPhase * 1.5) * 0.3}
          />
          <pixiText
            text="z"
            style={new TextStyle({ fontSize: 8, fill: 0x9999dd, fontFamily: "monospace" })}
            anchor={0.5}
            x={12}
            y={-animConfig.frameHeight / 2 - 7 + Math.sin(zzzPhase * 1.2 + 1) * 2}
            alpha={0.3 + Math.sin(zzzPhase * 1.5 + 1) * 0.3}
          />
          <pixiText
            text="z"
            style={new TextStyle({ fontSize: 10, fill: 0xaaaaee, fontFamily: "monospace" })}
            anchor={0.5}
            x={16}
            y={-animConfig.frameHeight / 2 - 13 + Math.sin(zzzPhase * 1.2 + 2) * 2}
            alpha={0.2 + Math.sin(zzzPhase * 1.5 + 2) * 0.3}
          />
        </>
      )}
      {isSelected && (
        <>
          <pixiText
            text={"▶"}
            style={new TextStyle({ fontSize: 6, fill: 0xffff00, fontFamily: "sans-serif" })}
            anchor={0.5}
            x={-animConfig.frameWidth / 2 - 4 + Math.sin(timeRef.current * 3) * 1.5}
            y={0}
          />
          <pixiText
            text={"◀"}
            style={new TextStyle({ fontSize: 6, fill: 0xffff00, fontFamily: "sans-serif" })}
            anchor={0.5}
            x={animConfig.frameWidth / 2 + 4 - Math.sin(timeRef.current * 3) * 1.5}
            y={0}
          />
        </>
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
