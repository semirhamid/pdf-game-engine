export const WIDTH = 20;
export const HEIGHT = 15;
export const FLOORS = 5;

export const T_WALL = 0;
export const T_FLOOR = 1;
export const T_DOOR = 2;
export const T_DOOR_OPEN = 3;
export const T_LOCKED = 4;
export const T_STAIRS = 5;

export type ItemKind = 'key' | 'coin' | 'gem' | 'potion' | 'sword' | 'shield' | 'crown';
export type EnemyKind = 'slime' | 'bat' | 'skeleton' | 'warden';
export type Action = 'up' | 'down' | 'left' | 'right' | 'wait' | 'potion';
export type Status = 'playing' | 'dead' | 'won';

export interface Point {
  x: number;
  y: number;
}

export interface Item extends Point {
  kind: ItemKind;
}

export interface Enemy extends Point {
  id: number;
  kind: EnemyKind;
  hp: number;
  // turns it will keep chasing after losing sight of the player
  alert: number;
}

export interface Level {
  terrain: number[];
  start: Point;
  goal: Point; // stairs, or the crown on the last floor
  items: Item[];
  enemies: Enemy[];
}

export interface Player extends Point {
  hp: number;
  maxHp: number;
  attack: number;
  defence: number;
  keys: number;
  potions: number;
}

// What happened this turn, for the message log and hit flashes.
export interface GameEvent {
  type:
    | 'move'
    | 'bump'
    | 'open'
    | 'unlock'
    | 'locked'
    | 'pickup'
    | 'hit'
    | 'kill'
    | 'hurt'
    | 'heal'
    | 'nopotion'
    | 'descend'
    | 'death'
    | 'win';
  id?: number;
  amount?: number;
  what?: string;
}

export interface GameState {
  seed: number;
  rng: { s: number };
  floor: number;
  turn: number;
  score: number;
  kills: number;
  status: Status;
  player: Player;
  terrain: number[];
  items: Item[];
  enemies: Enemy[];
  explored: boolean[];
  visible: boolean[];
  events: GameEvent[];
}

// up, right, down, left
export const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function at(x: number, y: number): number {
  return y * WIDTH + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

export function distance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function filled<T>(value: T): T[] {
  const cells: T[] = [];
  for (let i = 0; i < WIDTH * HEIGHT; i++) cells.push(value);
  return cells;
}
