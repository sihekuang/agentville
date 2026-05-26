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
    let cancelled = false;
    Assets.load<Texture>(src).then((t) => {
      if (!cancelled) {
        t.source.scaleMode = "nearest";
        setBaseTexture(t);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
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
