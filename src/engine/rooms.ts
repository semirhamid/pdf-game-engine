import { chance, int, pick, type Rng } from './rng.ts';
import {
  at,
  DIRECTIONS,
  filled,
  HEIGHT,
  inBounds,
  T_FLOOR,
  T_WALL,
  WIDTH,
  type Point,
} from './types.ts';

const MIN_ROOM = 3;
const SMALL_ENOUGH = 24;

// An opening in a wall, and the two rooms it joins.
export interface Gap extends Point {
  a: number;
  b: number;
}

// Splits the area with a wall that has one opening, then splits both halves. One opening per
// wall means the rooms form a tree, so every room is reachable without checking.
export function divide(
  rng: Rng,
  terrain: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  openings: Point[],
): void {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const fitsVertical = w >= MIN_ROOM * 2 + 1;
  const fitsHorizontal = h >= MIN_ROOM * 2 + 1;
  if ((!fitsVertical && !fitsHorizontal) || w * h <= SMALL_ENOUGH) return;

  const verticalFirst =
    fitsVertical && (!fitsHorizontal || w > h || (w === h && chance(rng, 50)));

  for (const vertical of [verticalFirst, !verticalFirst]) {
    if (vertical ? !fitsVertical : !fitsHorizontal) continue;

    // Skip positions where the wall would run into an existing opening.
    const options: number[] = [];
    if (vertical) {
      for (let x = x0 + MIN_ROOM; x <= x1 - MIN_ROOM; x++) {
        if (terrain[at(x, y0 - 1)] === T_WALL && terrain[at(x, y1 + 1)] === T_WALL) {
          options.push(x);
        }
      }
    } else {
      for (let y = y0 + MIN_ROOM; y <= y1 - MIN_ROOM; y++) {
        if (terrain[at(x0 - 1, y)] === T_WALL && terrain[at(x1 + 1, y)] === T_WALL) {
          options.push(y);
        }
      }
    }
    if (!options.length) continue;

    const wall = pick(rng, options);
    if (vertical) {
      for (let y = y0; y <= y1; y++) terrain[at(wall, y)] = T_WALL;
      const opening = { x: wall, y: y0 + int(rng, h) };
      terrain[at(opening.x, opening.y)] = T_FLOOR;
      openings.push(opening);
      divide(rng, terrain, x0, y0, wall - 1, y1, openings);
      divide(rng, terrain, wall + 1, y0, x1, y1, openings);
    } else {
      for (let x = x0; x <= x1; x++) terrain[at(x, wall)] = T_WALL;
      const opening = { x: x0 + int(rng, w), y: wall };
      terrain[at(opening.x, opening.y)] = T_FLOOR;
      openings.push(opening);
      divide(rng, terrain, x0, y0, x1, wall - 1, openings);
      divide(rng, terrain, x0, wall + 1, x1, y1, openings);
    }
    return;
  }
}
