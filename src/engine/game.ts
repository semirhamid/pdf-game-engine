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

// Returns whether it used up the turn. Walking into a wall doesn't.
function movePlayer(state: GameState, dx: number, dy: number): boolean {
  const { player, terrain, events } = state;
  const x = player.x + dx;
  const y = player.y + dy;
  const cell = at(x, y);
  const tile = inBounds(x, y) ? terrain[cell] : T_WALL;

  if (tile === T_WALL) {
    events.push({ type: 'bump' });
    return false;
  }
  const enemy = enemyAt(state, x, y);
  if (enemy) {
    playerAttack(state, enemy);
    return true;
  }
  if (tile === T_LOCKED) {
    if (!player.keys) {
      events.push({ type: 'locked' });
      return false;
    }
    player.keys--;
    terrain[cell] = T_DOOR_OPEN;
    events.push({ type: 'unlock' });
    return true;
  }
  if (tile === T_DOOR) {
    terrain[cell] = T_DOOR_OPEN;
    events.push({ type: 'open' });
    return true;
  }

  player.x = x;
  player.y = y;
  const item = itemAt(state, x, y);
  if (item) pickUp(state, item);
  else events.push({ type: 'move' });
  return true;
}

function drinkPotion(state: GameState): boolean {
  const { player, events } = state;
  if (!player.potions || player.hp === player.maxHp) {
    events.push({ type: 'nopotion', amount: player.potions });
    return false;
  }
  const before = player.hp;
  player.potions--;
  player.hp = Math.min(player.maxHp, player.hp + POTION_HEAL);
  events.push({ type: 'heal', amount: player.hp - before });
  return true;
}

function perform(state: GameState, action: Action): boolean {
  switch (action) {
    case 'up':
      return movePlayer(state, 0, -1);
    case 'down':
      return movePlayer(state, 0, 1);
    case 'left':
      return movePlayer(state, -1, 0);
    case 'right':
      return movePlayer(state, 1, 0);
    case 'potion':
      return drinkPotion(state);
    default:
      return true; // waiting
  }
}

export function step(state: GameState, action: Action): void {
  state.events = [];
  if (state.status !== 'playing' || !perform(state, action)) return;
  state.turn++;

  const { player } = state;
  if (state.status === 'playing' && state.terrain[at(player.x, player.y)] === T_STAIRS) {
    state.score += DESCEND_SCORE;
    player.hp = Math.min(player.maxHp, player.hp + DESCEND_HEAL);
    state.events.push({ type: 'descend', amount: state.floor + 1 });
    enterFloor(state, state.floor + 1);
    return;
  }
  if (state.status === 'playing') enemyTurn(state);
  updateVisibility(state);
}

const REPLAY_KEYS: { [key: string]: Action } = {
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  '.': 'wait',
  q: 'potion',
};

// Plays back a recorded run, e.g. replay(7, 'wwd.q').
export function replay(seed: number, inputs: string): GameState {
  const state = newGame(seed);
  for (let i = 0; i < inputs.length; i++) step(state, REPLAY_KEYS[inputs.charAt(i)]!);
  return state;
}
