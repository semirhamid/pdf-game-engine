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

export const FLOOR_ENEMIES: EnemyKind[][] = [
  ['slime', 'slime', 'bat'],
  ['slime', 'slime', 'bat', 'bat', 'skeleton'],
  ['slime', 'slime', 'bat', 'bat', 'skeleton', 'skeleton'],
  ['slime', 'bat', 'bat', 'skeleton', 'skeleton', 'skeleton'],
  ['slime', 'bat', 'bat', 'skeleton', 'skeleton', 'skeleton', 'warden'],
];

export const FLOOR_ITEMS: ItemKind[][] = [
  ['coin', 'coin', 'coin', 'coin', 'potion'],
  ['coin', 'coin', 'coin', 'gem', 'potion', 'sword'],
  ['coin', 'coin', 'gem', 'potion', 'potion', 'shield'],
  ['coin', 'coin', 'gem', 'gem', 'potion', 'sword'],
  ['coin', 'gem', 'gem', 'potion', 'potion'],
];

export const ITEM_NAMES: { [K in ItemKind]: string } = {
  key: 'A BRASS KEY',
  coin: 'A GOLD COIN',
  gem: 'A RUBY',
  potion: 'A POTION',
  sword: 'A SHARPER SWORD',
  shield: 'A STURDY SHIELD',
  crown: 'THE ASHEN CROWN',
};

export const ITEM_SCORE: { [K in ItemKind]: number } = {
  key: 5,
  coin: 10,
  gem: 50,
  potion: 5,
  sword: 25,
  shield: 25,
  crown: 500,
};

export const START_HP = 12;
export const START_ATTACK = 2;
export const POTION_HEAL = 6;
export const DESCEND_HEAL = 3;
export const DESCEND_SCORE = 100;
export const CRIT_PERCENT = 12;
export const ALERT_TURNS = 6;
export const VIEW_RADIUS = 7;
