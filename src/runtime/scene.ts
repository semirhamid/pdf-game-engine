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
