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

export function updateVisibility(state: GameState): void {
  const { terrain, player } = state;
  const visible = filled(false);
  const reach = VIEW_RADIUS * VIEW_RADIUS + 1; // the +1 rounds off the circle

  for (let y = player.y - VIEW_RADIUS; y <= player.y + VIEW_RADIUS; y++) {
    for (let x = player.x - VIEW_RADIUS; x <= player.x + VIEW_RADIUS; x++) {
      if (!inBounds(x, y) || isOpaque(terrain[at(x, y)])) continue;
      const dx = x - player.x;
      const dy = y - player.y;
      if (dx * dx + dy * dy > reach) continue;
      if (lineOfSight(terrain, player.x, player.y, x, y)) visible[at(x, y)] = true;
    }
  }

  // Rays miss wall corners, so light any wall that touches a visible floor cell instead.
  const touchesVisibleFloor = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!inBounds(x + dx, y + dy)) continue;
        const cell = at(x + dx, y + dy);
        if (visible[cell] && !isOpaque(terrain[cell])) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = at(x, y);
      if (isOpaque(terrain[cell]) && touchesVisibleFloor(x, y)) visible[cell] = true;
      if (visible[cell]) state.explored[cell] = true;
    }
  }
  state.visible = visible;
}
