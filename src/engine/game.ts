import { enemyTurn } from './ai.ts';
import { playerAttack } from './combat.ts';
import { updateVisibility } from './fov.ts';
import { generateLevel } from './generate.ts';
import { makeRng } from './rng.ts';
import {
  DESCEND_HEAL,
  DESCEND_SCORE,
  ITEM_NAMES,
  ITEM_SCORE,
  POTION_HEAL,
  START_ATTACK,
  START_HP,
} from './rules.ts';
import {
  at,
  filled,
  inBounds,
  T_DOOR,
  T_DOOR_OPEN,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  type Action,
  type Enemy,
  type GameState,
  type Item,
  type Point,
} from './types.ts';

function enterFloor(state: GameState, floor: number): void {
  const level = generateLevel(state.seed, floor);
  state.floor = floor;
  state.terrain = level.terrain;
  state.items = level.items;
  state.enemies = level.enemies;
  state.player.x = level.start.x;
  state.player.y = level.start.y;
  state.player.keys = 0;
  state.explored = filled(false);
  updateVisibility(state);
}

export function newGame(seed: number): GameState {
  const state: GameState = {
    seed: seed | 0,
    rng: makeRng(seed),
    floor: 1,
    turn: 0,
    score: 0,
    kills: 0,
    status: 'playing',
    player: {
      x: 0,
      y: 0,
      hp: START_HP,
      maxHp: START_HP,
      attack: START_ATTACK,
      defence: 0,
      keys: 0,
      potions: 0,
    },
    terrain: [],
    items: [],
    enemies: [],
    explored: [],
    visible: [],
    events: [],
  };
  enterFloor(state, 1);
  return state;
}

function findAt<T extends Point>(list: T[], x: number, y: number): T | null {
  for (const thing of list) if (thing.x === x && thing.y === y) return thing;
  return null;
}

export function enemyAt(state: GameState, x: number, y: number): Enemy | null {
  return findAt(state.enemies, x, y);
}

export function itemAt(state: GameState, x: number, y: number): Item | null {
  return findAt(state.items, x, y);
}

function pickUp(state: GameState, item: Item): void {
  const { player } = state;
  state.items.splice(state.items.indexOf(item), 1);
  state.score += ITEM_SCORE[item.kind];
  state.events.push({ type: 'pickup', what: ITEM_NAMES[item.kind] });
  switch (item.kind) {
    case 'key':
      player.keys++;
      break;
    case 'potion':
      player.potions++;
      break;
    case 'sword':
      player.attack++;
      break;
    case 'shield':
      player.defence++;
      break;
    case 'crown':
      state.score += player.hp * 10;
      state.status = 'won';
      state.events.push({ type: 'win' });
      break;
  }
}
