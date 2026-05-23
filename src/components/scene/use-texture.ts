"use client";

import { useState, useEffect } from "react";
import { Assets, Texture } from "pixi.js";

export function useTexture(src: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    Assets.load<Texture>(src).then((t) => {
      if (!cancelled) setTexture(t);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return texture;
}
