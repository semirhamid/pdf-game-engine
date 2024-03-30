import { hashState } from '../engine/game.ts';
import {
  at,
  filled,
  FLOORS,
  HEIGHT,
  inBounds,
  T_DOOR,
  T_DOOR_OPEN,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  WIDTH,
  type EnemyKind,
  type GameEvent,
  type GameState,
} from '../engine/types.ts';
import { ACTOR, TILE, TILE_DIM } from '../art/tiles.ts';
import { F, MESSAGE_LINES } from './fields.ts';

export type Screen = 'title' | 'playing' | 'help' | 'dead' | 'won';
export type Mode = 'tiles' | 'ascii';

export interface Ui {
  screen: Screen;
  mode: Mode;
  best: number;
  messages: string[];
  flash: number[]; // enemy ids drawn as hit this frame, 0 is the player
  keyboardFocused: boolean;
  debug: string | null;
}

export interface Frame {
  values: { [field: string]: string };
  visible: { [field: string]: boolean };
}

type TileName = keyof typeof TILE;

const FLOOR_NAMES = ['CELLAR', 'OSSUARY', 'CISTERN', 'ARMORY', 'ASHEN VAULT'];

const HURT: { [K in EnemyKind]: string } = {
  slime: ACTOR.slimeHurt,
  bat: ACTOR.batHurt,
  skeleton: ACTOR.skeletonHurt,
  warden: ACTOR.wardenHurt,
};

function wallName(state: GameState, x: number, y: number): TileName {
  const below = inBounds(x, y + 1) ? state.terrain[at(x, y + 1)] : T_WALL;
  if (below === T_WALL) return 'wallTop';
  return (x * 5 + y * 3) % 7 === 0 ? 'wallTorch' : 'wallFace';
}

function floorName(x: number, y: number): TileName {
  const n = (x * 31 + y * 17 + ((x * y) % 5)) % 9;
  return n === 0 ? 'floorB' : n < 3 ? 'floorC' : 'floorA';
}

function tileName(state: GameState, x: number, y: number): TileName {
  switch (state.terrain[at(x, y)]) {
    case T_WALL:
      return wallName(state, x, y);
    case T_DOOR:
      return 'door';
    case T_DOOR_OPEN:
      return 'doorOpen';
    case T_LOCKED:
      return 'locked';
    case T_STAIRS:
      return 'stairs';
    default:
      return floorName(x, y);
  }
}

export function terrainRow(state: GameState, y: number): string {
  let row = '';
  for (let x = 0; x < WIDTH; x++) {
    const cell = at(x, y);
    if (!state.explored[cell]) row += TILE.void;
    else row += (state.visible[cell] ? TILE : TILE_DIM)[tileName(state, x, y)];
  }
  return row;
}

// Later entries win: items, then monsters in sight, then the player.
export function actorCells(state: GameState, flash: number[]): string[] {
  const cells: string[] = filled<string>(ACTOR.none);
  const isHit = (id: number) => flash.indexOf(id) !== -1;

  for (const item of state.items) {
    const cell = at(item.x, item.y);
    if (state.explored[cell]) cells[cell] = ACTOR[item.kind];
  }
  for (const enemy of state.enemies) {
    const cell = at(enemy.x, enemy.y);
    if (state.visible[cell])
      cells[cell] = isHit(enemy.id) ? HURT[enemy.kind] : ACTOR[enemy.kind];
  }
  cells[at(state.player.x, state.player.y)] = isHit(0) ? ACTOR.heroHurt : ACTOR.hero;
  return cells;
}

function rowOf(cells: string[], y: number): string {
  return cells.slice(y * WIDTH, (y + 1) * WIDTH).join('');
}

// One layer of plain text for viewers that can't draw the tile font.
export function asciiRow(state: GameState, actors: string[], y: number): string {
  let row = '';
  for (let x = 0; x < WIDTH; x++) {
    const cell = at(x, y);
    const actor = actors[cell]!;
    if (actor !== ACTOR.none) row += actor;
    else row += state.explored[cell] ? TILE[tileName(state, x, y)] : TILE.void;
  }
  return row;
}

export function hearts(hp: number, maxHp: number): string {
  let out = '';
  for (let i = 0; i < maxHp; i += 2) {
    if (hp >= i + 2) out += ACTOR.heart;
    else out += hp === i + 1 ? ACTOR.heartHalf : ACTOR.heartEmpty;
  }
  return out;
}

function bits(value: number, count: number): string {
  let out = '';
  for (let i = count - 1; i >= 0; i--) out += (value >>> i) & 1 ? ACTOR.bitOn : ACTOR.bitOff;
  return out;
}

// Black and white squares the browser tests read from a screenshot: a 1010 marker, the state
// hash and the low byte of the turn counter.
export function telemetryBits(state: GameState): string {
  return bits(10, 4) + bits(hashState(state), 32) + bits(state.turn, 8);
}

export function describe(event: GameEvent): string {
  const { amount, what } = event;
  switch (event.type) {
    case 'open':
      return 'THE DOOR CREAKS OPEN.';
    case 'unlock':
      return 'YOU TURN THE KEY. THE LOCK GIVES WAY.';
    case 'locked':
      return 'LOCKED. A KEY MUST BE SOMEWHERE CLOSE.';
    case 'pickup':
      return `YOU FIND ${what}.`;
    case 'hit':
      return `YOU HIT THE ${what} FOR ${amount}.`;
    case 'kill':
      return `YOU SLAY THE ${what}!`;
    case 'hurt':
      return `THE ${what} HITS YOU FOR ${amount}.`;
    case 'heal':
      return `THE POTION RESTORES ${amount} HEALTH.`;
    case 'nopotion':
      return amount ? 'YOU ARE ALREADY AT FULL HEALTH.' : 'YOU HAVE NO POTIONS.';
    case 'descend':
      return `YOU DESCEND TO FLOOR ${amount}.`;
    default:
      return '';
  }
}
