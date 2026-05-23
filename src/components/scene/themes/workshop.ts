import type { SceneTheme } from "./theme-types";

export const workshopTheme: SceneTheme = {
  name: "workshop",
  tileSize: 32,
  gridCols: 8,
  gridRows: 6,
  floor: {
    src: "/sprites/workshop/floor.png",
    tileWidth: 32,
    tileHeight: 32,
  },
  props: [
    { slot: "entrance", src: "/sprites/workshop/garage-door.png", width: 32, height: 64 },
    { slot: "workstation", src: "/sprites/workshop/workbench.png", width: 64, height: 32 },
    { slot: "storage", src: "/sprites/workshop/shelf.png", width: 32, height: 48 },
  ],
  agent: {
    src: "/sprites/workshop/agent.png",
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:          { row: 0, frames: 2, speed: 0.02 },
      thinking:      { row: 1, frames: 4, speed: 0.05 },
      "tool:Read":   { row: 2, frames: 2, speed: 0.03 },
      "tool:Edit":   { row: 3, frames: 4, speed: 0.08 },
      "tool:Bash":   { row: 4, frames: 4, speed: 0.06 },
      "tool:Write":  { row: 3, frames: 4, speed: 0.08 },
      "tool:Agent":  { row: 5, frames: 4, speed: 0.05 },
      "tool:other":  { row: 2, frames: 2, speed: 0.03 },
      writing:       { row: 3, frames: 4, speed: 0.1 },
    },
  },
  agentSlots: [
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
    { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 },
  ],
};
