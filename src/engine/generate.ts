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

function attempt(rng: Rng, floor: number): Level | null {
  const terrain = emptyMap();
  const openings: Point[] = [];
  divide(rng, terrain, 1, 1, WIDTH - 2, HEIGHT - 2, openings);

  const { label, rooms } = labelRooms(terrain, openings);
  const gaps: Gap[] = [];
  for (const { x, y } of openings) {
    const pair = roomsBeside(label, x, y);
    if (!pair) return null;
    gaps.push({ x, y, a: pair[0], b: pair[1] });
  }

  const roomIds = rooms.map((_, i) => i);
  const startRoom = pick(rng, roomIds);
  const walk = walkRooms(rooms.length, gaps, startRoom, []);
  const goalRoom = roomIds.reduce(
    (best, id) => (walk.dist[id]! > walk.dist[best]! ? id : best),
    startRoom,
  );
  if (walk.dist[goalRoom]! < 2) return null;

  const locks = chooseLocks(rng, pathTo(goalRoom, startRoom, walk.cameBy), floor);

  // How many locks stand between the start and each room.
  const locksBefore = roomIds.map(() => -1);
  for (let opened = 0; opened <= locks.length; opened++) {
    const { dist } = walkRooms(rooms.length, gaps, startRoom, locks.slice(opened));
    for (const id of roomIds) {
      if (locksBefore[id] === -1 && dist[id]! >= 0) locksBefore[id] = opened;
    }
  }

  const doors: Point[] = [];
  for (const gap of gaps) {
    doors.push(gap);
    const locked = locks.indexOf(gap) !== -1;
    terrain[at(gap.x, gap.y)] = locked ? T_LOCKED : chance(rng, 60) ? T_DOOR : T_FLOOR;
  }
  addLoops(rng, terrain, label, locksBefore, doors);
  addPillars(rng, terrain, rooms);

  // Keep doorways and the cells next to them free.
  const used: boolean[] = [];
  for (const door of doors) {
    used[at(door.x, door.y)] = true;
    for (const dir of DIRECTIONS) used[at(door.x + dir.x, door.y + dir.y)] = true;
  }

  const place = (room: number, allowed?: (p: Point) => boolean): Point | null => {
    const options = rooms[room]!.filter((p) => {
      const cell = at(p.x, p.y);
      return terrain[cell] === T_FLOOR && !used[cell] && (!allowed || allowed(p));
    });
    if (!options.length) return null;
    const { x, y } = pick(rng, options);
    used[at(x, y)] = true;
    return { x, y };
  };
  const placeAnywhere = (allowed?: (p: Point) => boolean): Point | null => {
    for (let i = 0; i < 24; i++) {
      const p = place(pick(rng, roomIds), allowed);
      if (p) return p;
    }
    return null;
  };

  const start = place(startRoom);
  const goal = place(goalRoom);
  if (!start || !goal) return null;

  const items: Item[] = [];
  for (let k = 0; k < locks.length; k++) {
    // Prefer a room other than the one the player wakes up in.
    const order = shuffle(
      rng,
      roomIds.filter((id) => locksBefore[id] === k),
    ).sort((a, b) => Number(a === startRoom) - Number(b === startRoom));
    let spot: Point | null = null;
    for (const id of order) if (!spot) spot = place(id);
    if (!spot) return null;
    items.push({ kind: 'key', x: spot.x, y: spot.y });
  }

  if (floor === FLOORS) items.push({ kind: 'crown', x: goal.x, y: goal.y });
  else terrain[at(goal.x, goal.y)] = T_STAIRS;

  for (const kind of FLOOR_ITEMS[floor - 1]!) {
    const p = placeAnywhere();
    if (p) items.push({ kind, x: p.x, y: p.y });
  }

  const enemies: Enemy[] = [];
  const farFromStart = (p: Point) => distance(p, start) >= SAFE_DISTANCE;
  let id = 0;
  for (const kind of FLOOR_ENEMIES[floor - 1]!) {
    id++;
    const boss = kind === 'warden';
    const p = boss ? place(goalRoom, farFromStart) : placeAnywhere(farFromStart);
    if (p) enemies.push({ id, kind, x: p.x, y: p.y, hp: ENEMY_STATS[kind].hp, alert: 0 });
    else if (boss) return null;
  }

  return { terrain, start, goal, items, enemies };
}

// The same seed and floor always give the same level.
export function generateLevel(seed: number, floor: number): Level {
  const rng = makeRng((seed ^ (floor * 0x9e3779b1)) | 0);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const level = attempt(rng, floor);
    if (level && isSolvable(level)) return level;
  }
  throw new Error('Level generation failed for seed ' + seed + ' floor ' + floor);
}
