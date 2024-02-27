import { chance } from './rng.ts';
import { CRIT_PERCENT, ENEMY_STATS } from './rules.ts';
import type { Enemy, GameState } from './types.ts';

export function playerAttack(state: GameState, enemy: Enemy): void {
  const stats = ENEMY_STATS[enemy.kind];
  const crit = chance(state.rng, CRIT_PERCENT);
  const damage = state.player.attack * (crit ? 2 : 1);
  enemy.hp -= damage;
  enemy.alert = 99;

  if (enemy.hp > 0) {
    state.events.push({ type: 'hit', id: enemy.id, amount: damage, what: stats.name });
    return;
  }
  state.enemies.splice(state.enemies.indexOf(enemy), 1);
  state.kills++;
  state.score += stats.score;
  state.events.push({ type: 'kill', id: enemy.id, amount: damage, what: stats.name });
}

export function enemyAttack(state: GameState, enemy: Enemy): void {
  const { player } = state;
  const stats = ENEMY_STATS[enemy.kind];
  const damage = Math.max(1, stats.attack - player.defence);
  player.hp = Math.max(0, player.hp - damage);
  state.events.push({ type: 'hurt', id: enemy.id, amount: damage, what: stats.name });
  if (player.hp === 0) {
    state.status = 'dead';
    state.events.push({ type: 'death', what: stats.name });
  }
}
