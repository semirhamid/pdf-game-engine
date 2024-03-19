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

function floor(specks: number[][], cracks: number[][]): Painter {
  return (x, y) => {
    if (x === 15 || y === 15) return C.floorLo;
    if (has(cracks, x, y)) return C.floorLo;
    if (has(specks, x, y)) return C.grit;
    if (x === 0 || y === 0) return C.floorHi;
    return C.floor;
  };
}

function bricks(x: number, y: number): number {
  if (y < 3) return y === 0 ? C.cap : y === 1 ? C.brickHi : C.mortar;
  if (y === 15) return C.shadow;
  const row = Math.floor((y - 3) / 4),
    ry = (y - 3) % 4;
  const bx = (x + (row % 2 ? 4 : 0)) % 8;
  if (ry === 3 || bx === 7) return C.mortar;
  if (ry === 0) return C.brickHi;
  return bx === 0 || ry === 2 ? C.brickLo : C.brick;
}

function door(x: number, y: number): number {
  if (y < 2 || x < 2 || x > 13) return y === 0 || x === 1 || x === 14 ? C.brickHi : C.brickLo;
  if (y === 4 || y === 12) return C.iron;
  if ((x - 2) % 4 === 3) return C.woodLo;
  return (x - 2) % 4 === 0 ? C.woodHi : C.wood;
}

const plain = floor(
  [
    [3, 4],
    [11, 9],
    [6, 12],
  ],
  [],
);

export const TERRAIN: Record<string, Grid> = {
  void: paint(() => C.void),
  floorA: paint(plain),
  floorB: paint(
    floor(
      [
        [10, 3],
        [4, 11],
      ],
      [
        [5, 5],
        [6, 6],
        [6, 7],
        [7, 8],
        [8, 8],
        [9, 9],
      ],
    ),
  ),
  floorC: paint(
    floor(
      [
        [2, 2],
        [12, 5],
        [8, 10],
        [13, 13],
      ],
      [],
    ),
  ),
  wallTop: paint((x, y) => ((x * 7 + y * 13) % 23 === 0 ? C.topHi : C.top)),
  wallFace: paint(bricks),
  wallTorch: paint((x, y) => {
    if (inRect(x, y, 7, 9, 8, 13)) return C.wood;
    if (inRect(x, y, 6, 8, 9, 8)) return C.iron;
    if (inRect(x, y, 7, 5, 8, 7)) return C.flameHi;
    if (inRect(x, y, 6, 5, 9, 7) || inRect(x, y, 7, 3, 8, 4)) return C.flame;
    if (inRect(x, y, 5, 6, 10, 7) || inRect(x, y, 7, 2, 7, 2)) return C.ember;
    return bricks(x, y);
  }),
  door: paint((x, y) => (inRect(x, y, 10, 8, 11, 9) ? C.gold : door(x, y))),
  doorOpen: paint((x, y) =>
    x < 3
      ? x === 1
        ? C.woodHi
        : C.woodLo
      : x > 12
        ? x === 14
          ? C.woodHi
          : C.woodLo
        : plain(x, y),
  ),
  locked: paint((x, y) => {
    if (inRect(x, y, 5, 6, 10, 11)) {
      if (inRect(x, y, 7, 8, 8, 10)) return C.void;
      return y === 6 || x === 5 ? 0xffd98a : C.gold;
    }
    if (inRect(x, y, 6, 4, 9, 5) && !inRect(x, y, 7, 5, 8, 5)) return C.iron;
    const d = door(x, y);
    return d === C.wood ? C.ironLo : d === C.woodHi ? C.iron : d;
  }),
  stairs: paint((x, y) => {
    if (x < 2 || x > 13 || y < 2 || y > 13) return plain(x, y);
    const i = Math.floor((y - 2) / 3);
    if (x < 2 + i * 2 || x > 13) return C.void;
    return (y - 2) % 3 === 0 ? C.stair : (y - 2) % 3 === 1 ? C.brick : C.stairLo;
  }),
};
