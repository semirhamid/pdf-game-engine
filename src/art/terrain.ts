import type { Grid } from './sprites.ts';

const C = {
  void: 0x0c0a14,
  floor: 0x2b2740,
  floorLo: 0x231f35,
  floorHi: 0x353050,
  grit: 0x3d3759,
  top: 0x272138,
  topHi: 0x322a48,
  brick: 0x6a5a86,
  brickHi: 0x8272a0,
  brickLo: 0x4d4168,
  mortar: 0x2a2340,
  cap: 0x9a8ab8,
  wood: 0x8a5a34,
  woodHi: 0xa9743f,
  woodLo: 0x5b3822,
  iron: 0x8f8aa0,
  ironLo: 0x4b4660,
  gold: 0xf2b84b,
  stair: 0x9a8ab8,
  stairLo: 0x4d4168,
  flame: 0xf2b84b,
  flameHi: 0xfff0b8,
  ember: 0xe8673c,
  shadow: 0x1e1a2c,
};

type Painter = (x: number, y: number) => number;

// Builds a tile by asking for the colour of each pixel.
function paint(painter: Painter): Grid {
  const pixels = Array.from({ length: 16 }, (_, i) => i);
  return pixels.map((y) => pixels.map((x) => painter(x, y)));
}

function inRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return x >= left && x <= right && y >= top && y <= bottom;
}

function has(points: number[][], x: number, y: number): boolean {
  return points.some((p) => p[0] === x && p[1] === y);
}
