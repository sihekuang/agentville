"use client";

import { useRef, useCallback } from "react";
import { extend, useTick } from "@pixi/react";
import { Container, Text } from "pixi.js";
import type { Text as PixiText, Container as PixiContainer } from "pixi.js";
import type { AgentAction } from "@/lib/types";
import type { ParticleStyle, ParticleActionConfig } from "./themes/theme-types";
import { themeParticles } from "./particle-configs";

extend({ Container, Text });

const MAX_PARTICLES = 5;

// --- Exported types and pure functions (testable) ---

export interface ActiveParticle {
  text: string;
  color: number;
  fontSize: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  age: number;
  lifetime: number;
  alpha: number;
  scale: number;
}

/**
 * Creates a particle at random position (x: ±8px, y: -8 to -4),
 * with randomized drift and lifetime.
 */
export function createParticle(
  style: ParticleStyle,
  drift: { dx: number; dy: number },
  lifetime: { min: number; max: number },
): ActiveParticle {
  return {
    text: style.text,
    color: style.color,
    fontSize: style.fontSize,
    x: (Math.random() - 0.5) * 16, // ±8px
    y: -4 - Math.random() * 4, // -8 to -4
    dx: drift.dx * (0.8 + Math.random() * 0.4), // ±20% variation
    dy: drift.dy * (0.8 + Math.random() * 0.4),
    age: 0,
    lifetime: lifetime.min + Math.random() * (lifetime.max - lifetime.min),
    alpha: 0,
    scale: 1.0,
  };
}

/**
 * Advances age, position. Alpha: fade in over first 20%, hold at 0.6,
 * fade out over last 40%. Scale: 1.0 -> 0.5 over lifetime.
 */
export function updateParticle(p: ActiveParticle, dt: number): void {
  p.age += dt;
  p.x += p.dx * dt;
  p.y += p.dy * dt;

  const progress = Math.min(p.age / p.lifetime, 1.0);

  // Alpha: fade in 0-20%, hold 20-60%, fade out 60-100%
  if (progress < 0.2) {
    p.alpha = (progress / 0.2) * 0.6;
  } else if (progress < 0.6) {
    p.alpha = 0.6;
  } else {
    p.alpha = 0.6 * (1.0 - (progress - 0.6) / 0.4);
  }

  // Scale: 1.0 -> 0.5 over lifetime
  p.scale = 1.0 - 0.5 * progress;
}

/**
 * Returns true with probability rate * dt (per-frame spawn check).
 */
export function shouldSpawn(rate: number, dt: number): boolean {
  return Math.random() < rate * dt;
}

// --- Component ---

interface AgentParticlesProps {
  themeName: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
}

export function AgentParticles({ themeName, currentAction, status }: AgentParticlesProps) {
  const particleMap = themeParticles[themeName];
  const action: AgentAction = status === "idle" ? "idle" : currentAction;
  // TEMP CAST: particleMap is now Partial<Record<NormalizedAction>>, but action is still
  // typed as AgentAction here. Removed in Task 8 when scene components migrate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: ParticleActionConfig | undefined = (particleMap as any)?.[action];

  const particlesRef = useRef<(ActiveParticle | null)[]>(
    Array.from({ length: MAX_PARTICLES }, () => null),
  );
  const textRefs = useRef<(PixiText | null)[]>(
    Array.from({ length: MAX_PARTICLES }, () => null),
  );

  const tick = useCallback(
    (ticker: { deltaTime: number; deltaMS: number }) => {
      if (!config) return;

      const dt = ticker.deltaMS / 1000; // convert ms to seconds
      const particles = particlesRef.current;

      // Update existing particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p) continue;

        updateParticle(p, dt);

        // Remove dead particles
        if (p.age > p.lifetime) {
          particles[i] = null;
          const textNode = textRefs.current[i];
          if (textNode) {
            textNode.alpha = 0;
          }
          continue;
        }

        // Sync to text ref
        const textNode = textRefs.current[i];
        if (textNode) {
          textNode.x = p.x;
          textNode.y = p.y;
          textNode.alpha = p.alpha;
          textNode.scale.set(p.scale);
        }
      }

      // Spawn new particles if under limit
      if (shouldSpawn(config.spawnRate, dt)) {
        for (let i = 0; i < MAX_PARTICLES; i++) {
          if (!particles[i]) {
            const style = config.styles[Math.floor(Math.random() * config.styles.length)];
            particles[i] = createParticle(style, config.drift, config.lifetime);

            // Initialize text ref
            const textNode = textRefs.current[i];
            if (textNode) {
              textNode.text = particles[i]!.text;
              textNode.style.fontSize = particles[i]!.fontSize;
              textNode.style.fill = particles[i]!.color;
              textNode.x = particles[i]!.x;
              textNode.y = particles[i]!.y;
              textNode.alpha = 0;
              textNode.scale.set(1.0);
            }
            break;
          }
        }
      }
    },
    [config],
  );

  useTick(tick);

  if (!config) return null;

  return (
    <pixiContainer>
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <pixiText
          key={i}
          ref={(el: PixiText | null) => {
            textRefs.current[i] = el;
          }}
          text=""
          alpha={0}
          anchor={0.5}
          style={{ fontSize: 3, fill: 0xffffff }}
        />
      ))}
    </pixiContainer>
  );
}
