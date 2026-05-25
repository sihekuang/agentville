"use client";

import { useCallback, useMemo, useRef } from "react";
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
  cwd: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
  animConfig: AgentAnimationConfig;
  onClick: (sessionId: string) => void;
  onDoubleClick: (sessionId: string) => void;
  isSelected: boolean;
  isDark: boolean;
}

function makeStyles(isDark: boolean) {
  return {
    label: new TextStyle({
      fontSize: 5,
      fill: isDark ? 0x999999 : 0x888888,
      fontFamily: "monospace",
      align: "center",
    }),
    selectedLabel: new TextStyle({
      fontSize: 5,
      fill: isDark ? 0xccaa00 : 0xaa7700,
      fontFamily: "monospace",
      align: "center",
    }),
    dirLabel: new TextStyle({
      fontSize: 7,
      fill: isDark ? 0xffffff : 0x222222,
      fontFamily: "monospace",
      align: "center",
    }),
    selectedDirLabel: new TextStyle({
      fontSize: 7,
      fill: isDark ? 0xffff00 : 0xcc8800,
      fontFamily: "monospace",
      align: "center",
    }),
    emote: new TextStyle({
      fontSize: 10,
      fill: isDark ? 0xffffff : 0x222222,
      fontFamily: "sans-serif",
      align: "center",
    }),
    zzz: [
      new TextStyle({ fontSize: 6, fill: isDark ? 0x8888cc : 0x8888aa, fontFamily: "monospace" }),
      new TextStyle({ fontSize: 8, fill: isDark ? 0x9999dd : 0x7777aa, fontFamily: "monospace" }),
      new TextStyle({ fontSize: 10, fill: isDark ? 0xaaaaee : 0x666699, fontFamily: "monospace" }),
    ],
    selector: new TextStyle({
      fontSize: 6,
      fill: isDark ? 0xffff00 : 0xcc8800,
      fontFamily: "sans-serif",
    }),
    idleTint: isDark ? 0x888888 : 0xaaaaaa,
  };
}

export function AgentSprite({
  x,
  y,
  sessionId,
  cwd,
  currentAction,
  status,
  animConfig,
  onClick,
  onDoubleClick,
  isSelected,
  isDark,
}: AgentSpriteProps) {
  const lastClickRef = useRef(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      onDoubleClick(sessionId);
      lastClickRef.current = 0;
      return;
    }
    lastClickRef.current = now;
    onClick(sessionId);
  }, [onClick, onDoubleClick, sessionId]);

  const texture = useTexture(animConfig.src);

  const styles = useMemo(() => makeStyles(isDark), [isDark]);

  const hitArea = useMemo(
    () => new Rectangle(
      -animConfig.frameWidth / 2 - 4,
      -animConfig.frameHeight / 2 - 4,
      animConfig.frameWidth + 8,
      animConfig.frameHeight + 28,
    ),
    [animConfig.frameWidth, animConfig.frameHeight],
  );

  const timeRef = useRef(Math.random() * Math.PI * 2);

  // Refs for imperative PixiJS mutations (no React re-renders per frame)
  const containerRef = useRef<Container>(null);
  const emoteRef = useRef<Text>(null);
  const zzzRefs = [useRef<Text>(null), useRef<Text>(null), useRef<Text>(null)] as const;
  const selectorRefs = [useRef<Text>(null), useRef<Text>(null)] as const;

  const tickCallback = useCallback(
    (ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime / 60;
      timeRef.current += dt;
      const t = timeRef.current;

      const container = containerRef.current;
      if (!container) return;

      if (status === "busy") {
        container.y = y + Math.sin(t * 3) * 1.5;

        const emote = emoteRef.current;
        if (emote) {
          emote.y = -animConfig.frameHeight / 2 - 6 + Math.sin(t * 2) * 3;
          emote.alpha = 0.7 + Math.sin(t * 4) * 0.3;
        }
      } else {
        container.y = y + Math.sin(t * 0.8) * 0.5;

        const [z0, z1, z2] = zzzRefs;
        if (z0.current) {
          z0.current.y = -animConfig.frameHeight / 2 - 2 + Math.sin(t * 1.2) * 2;
          z0.current.alpha = 0.4 + Math.sin(t * 1.5) * 0.3;
        }
        if (z1.current) {
          z1.current.y = -animConfig.frameHeight / 2 - 7 + Math.sin(t * 1.2 + 1) * 2;
          z1.current.alpha = 0.3 + Math.sin(t * 1.5 + 1) * 0.3;
        }
        if (z2.current) {
          z2.current.y = -animConfig.frameHeight / 2 - 13 + Math.sin(t * 1.2 + 2) * 2;
          z2.current.alpha = 0.2 + Math.sin(t * 1.5 + 2) * 0.3;
        }
      }

      // Selection arrows bounce
      const [leftArrow, rightArrow] = selectorRefs;
      if (leftArrow.current) {
        leftArrow.current.x = -animConfig.frameWidth / 2 - 4 + Math.sin(t * 3) * 1.5;
      }
      if (rightArrow.current) {
        rightArrow.current.x = animConfig.frameWidth / 2 + 4 - Math.sin(t * 3) * 1.5;
      }
    },
    [y, status, animConfig.frameHeight, animConfig.frameWidth],
  );

  useTick(tickCallback);

  const label = sessionId.slice(0, 6);
  const dirName = cwd.split("/").filter(Boolean).pop() || cwd;
  const tint = status === "busy" ? 0xffffff : styles.idleTint;
  const emote = formatAction(currentAction);

  return (
    <pixiContainer
      ref={containerRef}
      x={x}
      y={y}
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
        text={dirName}
        style={isSelected ? styles.selectedDirLabel : styles.dirLabel}
        anchor={0.5}
        y={animConfig.frameHeight / 2 + 6}
      />
      <pixiText
        text={label}
        style={isSelected ? styles.selectedLabel : styles.label}
        anchor={0.5}
        y={animConfig.frameHeight / 2 + 14}
      />
      {status === "busy" && emote && (
        <pixiText
          ref={emoteRef}
          text={emote}
          style={styles.emote}
          anchor={0.5}
          y={-animConfig.frameHeight / 2 - 6}
          alpha={1}
        />
      )}
      {status === "idle" && (
        <>
          <pixiText
            ref={zzzRefs[0]}
            text="z"
            style={styles.zzz[0]}
            anchor={0.5}
            x={8}
            y={-animConfig.frameHeight / 2 - 2}
            alpha={0.4}
          />
          <pixiText
            ref={zzzRefs[1]}
            text="z"
            style={styles.zzz[1]}
            anchor={0.5}
            x={12}
            y={-animConfig.frameHeight / 2 - 7}
            alpha={0.3}
          />
          <pixiText
            ref={zzzRefs[2]}
            text="z"
            style={styles.zzz[2]}
            anchor={0.5}
            x={16}
            y={-animConfig.frameHeight / 2 - 13}
            alpha={0.2}
          />
        </>
      )}
      {isSelected && (
        <>
          <pixiText
            ref={selectorRefs[0]}
            text={"▶"}
            style={styles.selector}
            anchor={0.5}
            x={-animConfig.frameWidth / 2 - 4}
            y={0}
          />
          <pixiText
            ref={selectorRefs[1]}
            text={"◀"}
            style={styles.selector}
            anchor={0.5}
            x={animConfig.frameWidth / 2 + 4}
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
