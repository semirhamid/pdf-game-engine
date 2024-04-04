// Positions in points, origin at the bottom left. The browser tests use these to aim clicks.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Button extends Box {
  label: string;
}

export const PAGE = { w: 880, h: 500 };
export const TILE = 28;
export const BOARD: Box = { x: 20, y: 52, w: 20 * TILE, h: 15 * TILE };
export const PANEL = { x: 600, w: 264 };
export const SEED: Box = { x: 744, y: 279, w: 120, h: 18 };
export const LAMP: Box = { x: 600, y: 31, w: 8, h: 8 };
export const BITS = { x: 600, y: 8, cell: 6, count: 44 };

export const BUTTONS: Record<string, Button> = {
  up: { x: 650, y: 138, w: 46, h: 38, label: '' },
  left: { x: 601, y: 97, w: 46, h: 38, label: '' },
  wait: { x: 650, y: 97, w: 46, h: 38, label: 'WAIT' },
  right: { x: 699, y: 97, w: 46, h: 38, label: '' },
  down: { x: 650, y: 56, w: 46, h: 38, label: '' },
  potion: { x: 768, y: 148, w: 96, h: 26, label: 'POTION Q' },
  help: { x: 768, y: 117, w: 96, h: 26, label: 'HELP H' },
  retry: { x: 768, y: 86, w: 96, h: 26, label: 'RETRY R' },
  new: { x: 768, y: 55, w: 96, h: 26, label: 'TITLE N' },
};
