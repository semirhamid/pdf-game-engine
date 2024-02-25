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
