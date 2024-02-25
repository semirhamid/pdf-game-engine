import { chance, makeRng, pick, shuffle, type Rng } from './rng.ts';
import { divide, labelRooms, otherSide, roomsBeside, walkRooms, type Gap } from './rooms.ts';
import { ENEMY_STATS, FLOOR_ENEMIES, FLOOR_ITEMS } from './rules.ts';
import { isSolvable } from './solver.ts';
import {
  at,
  DIRECTIONS,
  distance,
  FLOORS,
  HEIGHT,
  T_DOOR,
  T_FLOOR,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  WIDTH,
  type Enemy,
  type Item,
  type Level,
  type Point,
} from './types.ts';

const MAX_ATTEMPTS = 200;
const SAFE_DISTANCE = 5;

function emptyMap(): number[] {
  const terrain: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const edge = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
      terrain.push(edge ? T_WALL : T_FLOOR);
    }
  }
  return terrain;
}

function pathTo(room: number, start: number, cameBy: (Gap | null)[]): Gap[] {
  const path: Gap[] = [];
  while (room !== start) {
    const gap = cameBy[room]!;
    path.unshift(gap);
    room = otherSide(gap, room);
  }
  return path;
}

function chooseLocks(rng: Rng, path: Gap[], floor: number): Gap[] {
  const count = Math.min(floor >= 3 ? 2 : 1, path.length);
  const chosen = shuffle(
    rng,
    path.map((_, i) => i),
  ).slice(0, count);
  return chosen.sort((a, b) => a - b).map((i) => path[i]!);
}

// Extra doors make loops. Both rooms must be behind the same number of locks, or the loop
// would be a way around one.
function addLoops(
  rng: Rng,
  terrain: number[],
  label: number[],
  locksBefore: number[],
  doors: Point[],
): void {
  const walls: Point[] = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (terrain[at(x, y)] === T_WALL) walls.push({ x, y });
    }
  }
  shuffle(rng, walls);

  let added = 0;
  for (const wall of walls) {
    if (added === 2) return;
    const pair = roomsBeside(label, wall.x, wall.y);
    if (!pair || pair[0] === pair[1]) continue;
    if (locksBefore[pair[0]] !== locksBefore[pair[1]]) continue;
    if (doors.some((door) => distance(door, wall) < 4)) continue;
    terrain[at(wall.x, wall.y)] = T_DOOR;
    doors.push(wall);
    added++;
  }
}

// A pillar with open floor on all eight sides can't block a path.
function addPillars(rng: Rng, terrain: number[], rooms: Point[][]): void {
  for (let i = 0; i < 6; i++) {
    const cell = pick(rng, pick(rng, rooms));
    let clear = true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (terrain[at(cell.x + dx, cell.y + dy)] !== T_FLOOR) clear = false;
      }
    }
    if (clear) terrain[at(cell.x, cell.y)] = T_WALL;
  }
}
