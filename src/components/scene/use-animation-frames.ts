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

export function useAnimationFrames(
  src: string,
  animConfig: AgentAnimationConfig,
  currentAction: AgentAction,
  status: "busy" | "idle",
): { textures: Texture[] | null; speed: number } {
  const [baseTexture, setBaseTexture] = useState<Texture | null>(null);

  useEffect(() => {
    // No cancelled/active guard needed: Assets.load() returns the same
    // texture instance for the same URL, so duplicate calls from React
    // strict mode double-mounts are harmless (same reference = no re-render).
    Assets.load<Texture>(src).then((t) => {
      t.source.scaleMode = "nearest";
      setBaseTexture(t);
    }).catch(() => {});
  }, [src]);

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
