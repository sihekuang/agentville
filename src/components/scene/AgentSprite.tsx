"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatedSprite, Container, Graphics, Rectangle, Text, TextStyle, type Texture } from "pixi.js";
import { extend, useTick } from "@pixi/react";
import { useAnimationFrames } from "./use-animation-frames";
import { AgentParticles } from "./AgentParticles";
import type { AgentAction } from "@/lib/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

extend({ AnimatedSprite, Container, Text, Graphics });

interface AgentSpriteProps {
  x: number;
  y: number;
  sessionId: string;
  cwd: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
  animConfig: AgentAnimationConfig;
  baseTexture: Texture | null;
  onClick: (sessionId: string) => void;
  onDoubleClick: (sessionId: string) => void;
  isSelected: boolean;
  isDark: boolean;
  themeName: string;
}

const TEXT_RES = 4;

function makeStyles(isDark: boolean) {
  return {
    label: new TextStyle({
      fontSize: 5 * TEXT_RES,
      fill: isDark ? 0x999999 : 0x888888,
      fontFamily: "monospace",
      align: "center",
    }),
    selectedLabel: new TextStyle({
      fontSize: 5 * TEXT_RES,
      fill: isDark ? 0xccaa00 : 0xaa7700,
      fontFamily: "monospace",
      align: "center",
    }),
    dirLabel: new TextStyle({
      fontSize: 7 * TEXT_RES,
      fill: isDark ? 0xffffff : 0x222222,
      fontFamily: "monospace",
      align: "center",
    }),
    selectedDirLabel: new TextStyle({
      fontSize: 7 * TEXT_RES,
      fill: isDark ? 0xffff00 : 0xcc8800,
      fontFamily: "monospace",
      align: "center",
    }),
    emote: new TextStyle({
      fontSize: 10 * TEXT_RES,
      fill: isDark ? 0xffffff : 0x222222,
      fontFamily: "sans-serif",
      align: "center",
    }),
    zzz: [
      new TextStyle({ fontSize: 6 * TEXT_RES, fill: isDark ? 0x8888cc : 0x8888aa, fontFamily: "monospace" }),
      new TextStyle({ fontSize: 8 * TEXT_RES, fill: isDark ? 0x9999dd : 0x7777aa, fontFamily: "monospace" }),
      new TextStyle({ fontSize: 10 * TEXT_RES, fill: isDark ? 0xaaaaee : 0x666699, fontFamily: "monospace" }),
    ],
    selector: new TextStyle({
      fontSize: 6 * TEXT_RES,
      fill: isDark ? 0xffff00 : 0xcc8800,
      fontFamily: "sans-serif",
    }),
    idleTint: isDark ? 0x888888 : 0xaaaaaa,
  };
}

const BLANKET_COLORS: Record<string, number> = {
  office: 0x4466aa,
  farm: 0x557755,
  workshop: 0x885544,
};

const SLEEPING_HEAD = {
  skin: 0xffd2aa,
  eye: 0x1e1e32,
  cheek: 0xffaa96,
  mouth: 0xb46450,
  chin: 0xdcb48c,
  hair: {
    office: 0x3c281e,
    farm: 0xdcbe78,
    workshop: 0xc8aa28,
  } as Record<string, number>,
};

export function AgentSprite({
  x,
  y,
  sessionId,
  cwd,
  currentAction,
  status,
  animConfig,
  baseTexture,
  onClick,
  onDoubleClick,
  isSelected,
  isDark,
  themeName,
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

  const { textures, speed } = useAnimationFrames(baseTexture, animConfig, currentAction, status);

  if (process.env.NODE_ENV === "development") {
    const id = sessionId.slice(0, 6);
    const hasTex = !!textures;
    const hasBase = !!baseTexture;
    console.log(`[Sprite:render] ${id} status=${status} action=${currentAction} baseTex=${hasBase} textures=${hasTex} frames=${textures?.length ?? 0}`);
  }

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
  const squashRef = useRef({ active: false, t: 0 });
  const prevActionRef = useRef(currentAction);

  // Refs for imperative PixiJS mutations (no React re-renders per frame)
  const containerRef = useRef<Container>(null);
  const spriteRef = useRef<AnimatedSprite>(null);
  const shadowRef = useRef<Graphics>(null);
  const bedRef = useRef<Graphics>(null);
  const blanketRef = useRef<Graphics>(null);
  const headRef = useRef<Graphics>(null);
  const emoteRef = useRef<Text>(null);
  const zzzRefs = [useRef<Text>(null), useRef<Text>(null), useRef<Text>(null)] as const;
  const selectorRefs = [useRef<Text>(null), useRef<Text>(null)] as const;

  useEffect(() => {
    if (prevActionRef.current !== currentAction) {
      squashRef.current = { active: true, t: 0 };
      prevActionRef.current = currentAction;
    }
  }, [currentAction]);

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) {
      if (process.env.NODE_ENV === "development" && textures) {
        console.warn(`[Sprite:play] ${sessionId.slice(0, 6)} spriteRef is null but textures exist (${textures.length} frames)`);
      }
      return;
    }
    sprite.play();
    if (process.env.NODE_ENV === "development") {
      console.log(`[Sprite:play] ${sessionId.slice(0, 6)} playing ${textures?.length ?? 0} frames`);
    }
  }, [textures, sessionId]);

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
        container.y = y + Math.sin(t * 0.8) * 0.3;

        const [z0, z1, z2] = zzzRefs;
        if (z0.current) {
          z0.current.x = 14 + Math.sin(t * 0.8) * 1;
          z0.current.y = -13 + Math.sin(t * 1.2) * 2;
          z0.current.alpha = 0.4 + Math.sin(t * 1.5) * 0.3;
        }
        if (z1.current) {
          z1.current.x = 17 + Math.sin(t * 0.8 + 1) * 1;
          z1.current.y = -19 + Math.sin(t * 1.2 + 1) * 2;
          z1.current.alpha = 0.3 + Math.sin(t * 1.5 + 1) * 0.3;
        }
        if (z2.current) {
          z2.current.x = 20 + Math.sin(t * 0.8 + 2) * 1;
          z2.current.y = -26 + Math.sin(t * 1.2 + 2) * 2;
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

      const sprite = spriteRef.current;
      if (sprite) {
        const breathe = Math.sin(t * 2) * 0.02;
        sprite.scale.y = 1.0 + breathe;
        sprite.y = -breathe * animConfig.frameHeight * 0.5;
      }

      // Squash/stretch on action transitions
      const sq = squashRef.current;
      if (sq.active && sprite) {
        sq.t += dt;
        const duration = 0.15;
        const progress = Math.min(sq.t / duration, 1);
        const squashAmount = Math.sin(progress * Math.PI) * 0.12;
        sprite.scale.x = 1 + squashAmount;
        sprite.scale.y = 1 - squashAmount + Math.sin(t * 2) * 0.02; // keep breathing overlay
        if (progress >= 1) {
          sq.active = false;
          sprite.scale.x = 1;
          // Don't reset scale.y — let breathing resume naturally
        }
      }

      // Shadow — scales inversely with bob height
      const shadow = shadowRef.current;
      if (shadow) {
        const bobOffset = container.y - y;
        const shadowScale = 1.0 - Math.abs(bobOffset) * 0.03;
        shadow.scale.x = shadowScale;
        shadow.alpha = 0.15 * shadowScale;
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
      {status === "busy" && (
        <pixiGraphics
          ref={shadowRef}
          draw={(g: Graphics) => {
            g.clear();
            g.ellipse(0, animConfig.frameHeight / 2 + 1, 8, 3);
            g.fill({ color: 0x000000, alpha: 0.15 });
          }}
        />
      )}
      {status === "idle" && (
        <pixiGraphics
          ref={bedRef}
          draw={(g: Graphics) => {
            const frameColor = isDark ? 0x5a3820 : 0x6b4226;
            const headboardColor = isDark ? 0x3a2010 : 0x4a2c0f;
            const mattressColor = isDark ? 0xc0b0a0 : 0xf0e0cc;
            const pillowColor = isDark ? 0xcccccc : 0xeeeeee;
            g.clear();
            g.ellipse(0, 13, 18, 3);
            g.fill({ color: 0x000000, alpha: 0.06 });
            g.rect(17, -11, 5, 19);
            g.fill({ color: headboardColor });
            g.rect(-20, 4, 42, 3);
            g.fill({ color: frameColor });
            g.rect(-19, 7, 3, 4);
            g.fill({ color: frameColor });
            g.rect(18, 7, 3, 4);
            g.fill({ color: frameColor });
            g.rect(-20, -1, 37, 5);
            g.fill({ color: mattressColor });
            g.rect(10, -4, 7, 5);
            g.fill({ color: pillowColor });
          }}
        />
      )}
      {textures && status === "busy" && (
        <pixiAnimatedSprite
          ref={spriteRef}
          textures={textures}
          animationSpeed={speed}
          loop={true}
          anchor={0.5}
          tint={tint}
        />
      )}
      {status === "idle" && (
        <pixiGraphics
          ref={blanketRef}
          draw={(g: Graphics) => {
            const color = BLANKET_COLORS[themeName] ?? 0x4466aa;
            g.clear();
            g.rect(-18, -5, 16, 1);
            g.fill({ color });
            g.rect(-20, -4, 30, 3);
            g.fill({ color });
            g.rect(-20, -1, 30, 5);
            g.fill({ color });
          }}
        />
      )}
      {status === "idle" && (
        <pixiGraphics
          ref={headRef}
          draw={(g: Graphics) => {
            const hair = SLEEPING_HEAD.hair[themeName] ?? 0x3c281e;
            const { skin, eye, cheek, mouth, chin } = SLEEPING_HEAD;
            g.clear();
            // Standing head rotated 90° CW: hair→right, chin→left
            // Chin (leftmost)
            g.rect(9, -6, 1, 8); g.fill({ color: chin });
            // Chin/mouth/chin
            g.rect(10, -6, 1, 3); g.fill({ color: chin });
            g.rect(10, -3, 1, 3); g.fill({ color: mouth });
            g.rect(10, 0, 1, 2); g.fill({ color: chin });
            // Mouth features
            g.rect(11, -6, 1, 2); g.fill({ color: skin });
            g.rect(11, -4, 1, 1); g.fill({ color: mouth });
            g.rect(11, -3, 1, 3); g.fill({ color: skin });
            g.rect(11, 0, 1, 1); g.fill({ color: mouth });
            g.rect(11, 1, 1, 1); g.fill({ color: skin });
            // Cheeks
            g.rect(12, -6, 1, 1); g.fill({ color: skin });
            g.rect(12, -5, 1, 1); g.fill({ color: cheek });
            g.rect(12, -4, 1, 6); g.fill({ color: skin });
            g.rect(12, 2, 1, 1); g.fill({ color: cheek });
            // Below eyes
            g.rect(13, -6, 1, 8); g.fill({ color: skin });
            // Eyes (closed)
            g.rect(14, -6, 1, 2); g.fill({ color: skin });
            g.rect(14, -4, 1, 2); g.fill({ color: eye });
            g.rect(14, -2, 1, 2); g.fill({ color: skin });
            g.rect(14, 0, 1, 2); g.fill({ color: eye });
            // Forehead
            g.rect(15, -6, 2, 8); g.fill({ color: skin });
            // Hair
            g.rect(17, -7, 1, 10); g.fill({ color: hair });
            g.rect(18, -6, 1, 8); g.fill({ color: hair });
          }}
        />
      )}
      <AgentParticles
        themeName={themeName}
        currentAction={currentAction}
        status={status}
      />
      <pixiText
        text={dirName}
        style={isSelected ? styles.selectedDirLabel : styles.dirLabel}
        anchor={0.5}
        scale={1 / TEXT_RES}
        y={animConfig.frameHeight / 2 + 6}
      />
      <pixiText
        text={label}
        style={isSelected ? styles.selectedLabel : styles.label}
        anchor={0.5}
        scale={1 / TEXT_RES}
        y={animConfig.frameHeight / 2 + 14}
      />
      {status === "busy" && emote && (
        <pixiText
          ref={emoteRef}
          text={emote}
          style={styles.emote}
          anchor={0.5}
          scale={1 / TEXT_RES}
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
            scale={1 / TEXT_RES}
            x={14}
            y={-13}
            alpha={0.4}
          />
          <pixiText
            ref={zzzRefs[1]}
            text="z"
            style={styles.zzz[1]}
            anchor={0.5}
            scale={1 / TEXT_RES}
            x={17}
            y={-19}
            alpha={0.3}
          />
          <pixiText
            ref={zzzRefs[2]}
            text="z"
            style={styles.zzz[2]}
            anchor={0.5}
            scale={1 / TEXT_RES}
            x={20}
            y={-26}
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
            scale={1 / TEXT_RES}
            x={-animConfig.frameWidth / 2 - 4}
            y={0}
          />
          <pixiText
            ref={selectorRefs[1]}
            text={"◀"}
            style={styles.selector}
            anchor={0.5}
            scale={1 / TEXT_RES}
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
