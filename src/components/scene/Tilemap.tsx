"use client";

import { useMemo } from "react";
import { Container, Sprite, TilingSprite, Texture } from "pixi.js";
import { extend } from "@pixi/react";
import type { SceneTheme } from "./themes/theme-types";

extend({ Container, Sprite, TilingSprite });

interface TilemapProps {
  theme: SceneTheme;
}

export function Tilemap({ theme }: TilemapProps) {
  const totalWidth = theme.gridCols * theme.tileSize;
  const totalHeight = theme.gridRows * theme.tileSize;

  const floorTexture = useMemo(
    () => Texture.from(theme.floor.src),
    [theme.floor.src],
  );

  return (
    <pixiContainer>
      <pixiTilingSprite
        texture={floorTexture}
        width={totalWidth}
        height={totalHeight}
        tilePosition={{ x: 0, y: 0 }}
      />
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

/** Small wrapper so that Texture.from is memoised per src string. */
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
  const texture = useMemo(() => Texture.from(src), [src]);
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
