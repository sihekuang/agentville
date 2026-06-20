export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * New bounds for a resize that keeps the window centered on its current center,
 * then clamps it to stay fully within the work area. If the target exceeds the
 * work area, the size is capped to it (off-screen safeguard).
 */
export function computeResizedBounds(
  current: Bounds,
  targetW: number,
  targetH: number,
  workArea: Bounds,
): Bounds {
  const width = Math.min(targetW, workArea.width);
  const height = Math.min(targetH, workArea.height);

  const cx = current.x + current.width / 2;
  const cy = current.y + current.height / 2;
  let x = Math.round(cx - width / 2);
  let y = Math.round(cy - height / 2);

  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  x = Math.min(maxX, Math.max(workArea.x, x));
  y = Math.min(maxY, Math.max(workArea.y, y));

  return { x, y, width, height };
}

/** True when the cursor is more than `outset` px outside the window on any side. */
export function isCursorBeyond(
  cursor: { x: number; y: number },
  bounds: Bounds,
  outset: number,
): boolean {
  return (
    cursor.x < bounds.x - outset ||
    cursor.x > bounds.x + bounds.width + outset ||
    cursor.y < bounds.y - outset ||
    cursor.y > bounds.y + bounds.height + outset
  );
}
