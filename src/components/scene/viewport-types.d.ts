import type { Viewport } from "pixi-viewport";
import type { PixiElements } from "@pixi/react";

declare module "@pixi/react" {
  interface PixiElements {
    viewport: PixiElements["pixiContainer"] & {
      screenWidth?: number;
      screenHeight?: number;
      worldWidth?: number;
      worldHeight?: number;
      events?: unknown;
    };
  }
}
