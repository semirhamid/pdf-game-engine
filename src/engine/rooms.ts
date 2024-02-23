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

// Gives every floor cell a room number. Openings belong to no room (-1).
export function labelRooms(
  terrain: number[],
  openings: Point[],
): { label: number[]; rooms: Point[][] } {
  const isOpening = filled(false);
  for (const p of openings) isOpening[at(p.x, p.y)] = true;

  const label = filled(-1);
  const rooms: Point[][] = [];
  const unvisited = (x: number, y: number) => {
    const cell = at(x, y);
    return terrain[cell] === T_FLOOR && !isOpening[cell] && label[cell] === -1;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!unvisited(x, y)) continue;
      const id = rooms.length;
      const cells: Point[] = [{ x, y }];
      label[at(x, y)] = id;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!;
        for (const dir of DIRECTIONS) {
          const nx = cell.x + dir.x;
          const ny = cell.y + dir.y;
          if (!inBounds(nx, ny) || !unvisited(nx, ny)) continue;
          label[at(nx, ny)] = id;
          cells.push({ x: nx, y: ny });
        }
      }
      rooms.push(cells);
    }
  }
  return { label, rooms };
}

// The rooms on either side of a cell, if it sits in a straight wall between two of them.
export function roomsBeside(label: number[], x: number, y: number): [number, number] | null {
  const left = label[at(x - 1, y)]!;
  const right = label[at(x + 1, y)]!;
  const up = label[at(x, y - 1)]!;
  const down = label[at(x, y + 1)]!;
  if (left >= 0 && right >= 0 && up < 0 && down < 0) return [left, right];
  if (up >= 0 && down >= 0 && left < 0 && right < 0) return [up, down];
  return null;
}

export function otherSide(gap: Gap, room: number): number {
  return gap.a === room ? gap.b : gap.a;
}

// Breadth-first walk over rooms. Rooms that can't be reached keep distance -1.
export function walkRooms(
  roomCount: number,
  gaps: Gap[],
  from: number,
  closed: Gap[],
): { dist: number[]; cameBy: (Gap | null)[] } {
  const dist: number[] = [];
  const cameBy: (Gap | null)[] = [];
  for (let i = 0; i < roomCount; i++) {
    dist.push(-1);
    cameBy.push(null);
  }
  dist[from] = 0;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const room = queue[i]!;
    for (const gap of gaps) {
      if (closed.indexOf(gap) !== -1 || (gap.a !== room && gap.b !== room)) continue;
      const other = otherSide(gap, room);
      if (dist[other] !== -1) continue;
      dist[other] = dist[room]! + 1;
      cameBy[other] = gap;
      queue.push(other);
    }
  }
  return { dist, cameBy };
}
