import type { EnemyKind, ItemKind } from './types.ts';

export interface EnemyStats {
  name: string;
  hp: number;
  attack: number;
  score: number;
  sight: number;
}

// Tuned with `npm run bot`: the bot sees the whole map and wins about 77% of runs.
export const ENEMY_STATS: { [K in EnemyKind]: EnemyStats } = {
  slime: { name: 'SLIME', hp: 3, attack: 2, score: 10, sight: 5 },
  bat: { name: 'BAT', hp: 2, attack: 1, score: 15, sight: 7 },
  skeleton: { name: 'SKELETON', hp: 6, attack: 3, score: 25, sight: 8 },
  warden: { name: 'WARDEN', hp: 18, attack: 5, score: 200, sight: 9 },
};
