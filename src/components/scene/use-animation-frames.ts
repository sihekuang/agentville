"use client";

import { useState, useEffect, useMemo } from "react";
import { Assets, Texture, Rectangle } from "pixi.js";
import type { AgentAction } from "@/lib/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

export function sliceFrames(
  baseTexture: Texture,
  anim: { row: number; frames: number; speed: number },
  frameWidth: number,
  frameHeight: number,
): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < anim.frames; i++) {
    const frame = new Rectangle(
      i * frameWidth,
      anim.row * frameHeight,
      frameWidth,
      frameHeight,
    );
    frames.push(new Texture({ source: baseTexture.source, frame }));
  }
  return frames;
}

// Module-level texture cache — survives React strict mode unmount/remount
// and provides instant synchronous reads on subsequent mounts.
const textureCache = new Map<string, Texture>();

export function useLoadTexture(src: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(
    () => textureCache.get(src) ?? null,
  );

  useEffect(() => {
    if (textureCache.has(src)) {
      const cached = textureCache.get(src)!;
      setTexture(cached);
      return;
    }
    Assets.load<Texture>(src).then((t) => {
      t.source.scaleMode = "nearest";
      textureCache.set(src, t);
      setTexture(t);
    }).catch(() => {});
  }, [src]);

  return texture;
}

export function useAnimationFrames(
  baseTexture: Texture | null,
  animConfig: AgentAnimationConfig,
  currentAction: AgentAction,
  status: "busy" | "idle",
): { textures: Texture[] | null; speed: number } {
  const action = status === "idle" ? "idle" : currentAction;
  const anim = animConfig.animations[action] ?? animConfig.animations.idle;

  const textures = useMemo(() => {
    if (!baseTexture) return null;
    return sliceFrames(
      baseTexture,
      anim,
      animConfig.frameWidth,
      animConfig.frameHeight,
    );
  }, [baseTexture, anim.row, anim.frames, animConfig.frameWidth, animConfig.frameHeight]);

  return { textures, speed: anim.speed };
}
