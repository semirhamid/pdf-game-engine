import { newGame } from '../../src/engine/game.ts';
import { updateVisibility } from '../../src/engine/fov.ts';
import { ENEMY_STATS } from '../../src/engine/rules.ts';
import {
  at,
  HEIGHT,
  T_FLOOR,
  T_WALL,
  WIDTH,
  type EnemyKind,
  type GameState,
} from '../../src/engine/types.ts';

// An empty room with the player at (5, 5).
export function arena(seed = 1): GameState {
  const s = newGame(seed);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      s.terrain[at(x, y)] =
        x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? T_WALL : T_FLOOR;
    }
  s.items = [];
  s.enemies = [];
  s.player.x = 5;
  s.player.y = 5;
  updateVisibility(s);
  return s;
}

export function spawn(
  s: GameState,
  kind: EnemyKind,
  x: number,
  y: number,
  alert = 0,
): GameState['enemies'][number] {
  const e = { id: s.enemies.length + 1, kind, x, y, hp: ENEMY_STATS[kind].hp, alert };
  s.enemies.push(e);
  return e;
}
