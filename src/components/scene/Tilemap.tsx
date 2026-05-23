"use client";

import { useMemo } from "react";
import { Container, Sprite, TilingSprite, Texture } from "pixi.js";
import { extend } from "@pixi/react";
import { useTexture } from "./use-texture";
import type { SceneTheme } from "./themes/theme-types";

extend({ Container, Sprite, TilingSprite });

interface TilemapProps {
  theme: SceneTheme;
}

export function Tilemap({ theme }: TilemapProps) {
  const totalWidth = theme.gridCols * theme.tileSize;
  const totalHeight = theme.gridRows * theme.tileSize;

  const floorTexture = useTexture(theme.floor.src);

  return (
    <pixiContainer>
      {floorTexture && (
        <pixiTilingSprite
          texture={floorTexture}
          width={totalWidth}
          height={totalHeight}
          tilePosition={{ x: 0, y: 0 }}
        />
      )}
      {theme.props.map((prop, i) => {
        const positions = getPropPositions(prop.slot, theme);
        return positions.map((pos, j) => (
          <PropSprite
            key={`${prop.slot}-${i}-${j}`}
            src={prop.src}
            x={pos.x}
            y={pos.y}
            width={prop.width}
            height={prop.height}
          />
        ));
      })}
    </pixiContainer>
  );
}

function PropSprite({
  src,
  x,
  y,
  width,
  height,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const texture = useTexture(src);
  if (!texture) return null;
  return (
    <pixiSprite texture={texture} x={x} y={y} width={width} height={height} />
  );
}

function getPropPositions(
  slot: string,
  theme: SceneTheme,
): Array<{ x: number; y: number }> {
  const t = theme.tileSize;
  switch (slot) {
    case "entrance":
      return [{ x: 0, y: 0 }];
    case "workstation":
      return theme.agentSlots.map((s) => ({
        x: s.x * t - t / 2,
        y: s.y * t - t,
      }));
    case "storage":
      return [{ x: (theme.gridCols - 1) * t, y: (theme.gridRows - 2) * t }];
    default:
      return [];
  }
}
