import { enemyAttack } from './combat.ts';
import { lineOfSight } from './fov.ts';
import { chance, pick } from './rng.ts';
import { ALERT_TURNS, ENEMY_STATS } from './rules.ts';
import {
  at,
  DIRECTIONS,
  distance,
  filled,
  inBounds,
  T_DOOR_OPEN,
  T_FLOOR,
  T_STAIRS,
  WIDTH,
  type Enemy,
  type GameState,
  type Point,
} from './types.ts';

const UNREACHABLE = 9999;

// Monsters can't open doors.
export function monsterCanWalk(tile: number | undefined): boolean {
  return tile === T_FLOOR || tile === T_DOOR_OPEN || tile === T_STAIRS;
}

// Steps from the player to every cell. Computed once per turn and shared by all monsters.
export function distanceField(state: GameState): number[] {
  const dist = filled(UNREACHABLE);
  const queue = [at(state.player.x, state.player.y)];
  dist[queue[0]!] = 0;
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!;
    const x = from % WIDTH;
    const y = Math.floor(from / WIDTH);
    for (const dir of DIRECTIONS) {
      if (!inBounds(x + dir.x, y + dir.y)) continue;
      const cell = at(x + dir.x, y + dir.y);
      if (dist[cell] !== UNREACHABLE || !monsterCanWalk(state.terrain[cell])) continue;
      dist[cell] = dist[from]! + 1;
      queue.push(cell);
    }
  }
  return dist;
}

function isBlocked(state: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y) || !monsterCanWalk(state.terrain[at(x, y)])) return true;
  if (state.player.x === x && state.player.y === y) return true;
  return state.enemies.some((other) => other.x === x && other.y === y);
}

function tryMove(state: GameState, enemy: Enemy, dir: Point): void {
  if (isBlocked(state, enemy.x + dir.x, enemy.y + dir.y)) return;
  enemy.x += dir.x;
  enemy.y += dir.y;
}

function wander(state: GameState, enemy: Enemy): void {
  tryMove(state, enemy, pick(state.rng, DIRECTIONS));
}

function chase(state: GameState, enemy: Enemy, dist: number[]): void {
  let shortest = dist[at(enemy.x, enemy.y)]!;
  let best: Point | null = null;
  for (const dir of DIRECTIONS) {
    const x = enemy.x + dir.x;
    const y = enemy.y + dir.y;
    if (isBlocked(state, x, y) || dist[at(x, y)]! >= shortest) continue;
    shortest = dist[at(x, y)]!;
    best = dir;
  }
  if (best) tryMove(state, enemy, best);
}
