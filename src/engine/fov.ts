import { VIEW_RADIUS } from './rules.ts';
import {
  at,
  filled,
  HEIGHT,
  inBounds,
  T_DOOR,
  T_LOCKED,
  T_WALL,
  WIDTH,
  type GameState,
} from './types.ts';

export function isOpaque(tile: number | undefined): boolean {
  return tile === T_WALL || tile === T_DOOR || tile === T_LOCKED;
}

// Bresenham. The two end cells never block the line.
export function lineOfSight(
  terrain: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (x !== x1 || y !== y1) {
    if ((x !== x0 || y !== y0) && isOpaque(terrain[at(x, y)])) return false;
    const doubled = 2 * err;
    if (doubled >= dy) {
      err += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      err += dx;
      y += stepY;
    }
  }
  return true;
}
