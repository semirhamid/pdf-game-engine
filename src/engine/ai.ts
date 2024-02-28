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
