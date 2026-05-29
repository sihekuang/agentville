"use client";

import { useState, useEffect, useMemo } from "react";
import { Assets, Texture, Rectangle } from "pixi.js";
import type { NormalizedAction } from "@/lib/providers/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

const DEBUG = process.env.NODE_ENV === "development";

function log(tag: string, msg: string, data?: Record<string, unknown>) {
  if (!DEBUG) return;
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[Sprite:${tag}] ${msg}${payload}`);
}

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

// Module-level texture cache — survives React strict mode unmount/remount.
const textureCache = new Map<string, Texture>();

export function useLoadTexture(src: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(
    () => {
      const cached = textureCache.get(src) ?? null;
      log("load", cached ? "cache HIT (initializer)" : "cache MISS (initializer)", { src });
      return cached;
    },
  );

  useEffect(() => {
    if (textureCache.has(src)) {
      const cached = textureCache.get(src)!;
      log("load", "cache HIT (effect)", { src });
      setTexture(cached);
      return;
    }
    log("load", "loading via Assets.load()", { src });
    Assets.load<Texture>(src).then((t) => {
      log("load", "Assets.load() resolved", { src, textureValid: !!t?.source });
      t.source.scaleMode = "nearest";
      textureCache.set(src, t);
      setTexture(t);
    }).catch((err) => {
      log("load", "Assets.load() FAILED", { src, error: String(err) });
    });
  }, [src]);

  return texture;
}

export function useAnimationFrames(
  baseTexture: Texture | null,
  animConfig: AgentAnimationConfig,
  currentAction: NormalizedAction,
  status: "busy" | "idle",
): { textures: Texture[] | null; speed: number } {
  const action = status === "idle" ? "idle" : currentAction;
  const anim = animConfig.animations[action] ?? animConfig.animations.idle;

  const textures = useMemo(() => {
    if (!baseTexture) {
      log("frames", "baseTexture is null, returning null textures", { action, status });
      return null;
    }
    const sliced = sliceFrames(
      baseTexture,
      anim,
      animConfig.frameWidth,
      animConfig.frameHeight,
    );
    log("frames", `sliced ${sliced.length} frames`, { action, status, row: anim.row, frames: anim.frames });
    return sliced;
  }, [baseTexture, anim.row, anim.frames, animConfig.frameWidth, animConfig.frameHeight]);

  return { textures, speed: anim.speed };
}
