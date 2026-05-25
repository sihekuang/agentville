import type { AgentAction } from "@/lib/types";

export interface TileConfig {
  src: string;
  tileWidth: number;
  tileHeight: number;
}

export interface PropConfig {
  slot: "workstation" | "entrance" | "storage";
  src: string;
  width: number;
  height: number;
}

export interface AgentAnimationConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<AgentAction, { row: number; frames: number; speed: number }>;
}

export interface AgentSlot {
  x: number;
  y: number;
}

export interface SceneTheme {
  name: string;
  tileSize: number;
  gridCols: number;
  gridRows: number;
  floor: TileConfig;
  props: PropConfig[];
  agent: AgentAnimationConfig;
  agentSlots: AgentSlot[];
}

export interface ParticleStyle {
  text: string;
  color: number;
  fontSize: number;
}

export interface ParticleActionConfig {
  styles: ParticleStyle[];
  spawnRate: number;
  drift: { dx: number; dy: number };
  lifetime: { min: number; max: number };
}

export type ParticleMap = Partial<Record<AgentAction, ParticleActionConfig>>;
