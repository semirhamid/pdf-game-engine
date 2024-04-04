import { ADVANCE } from '../art/pixelfont.ts';
import { rgb, scale } from '../art/palette.ts';
import { WIDTH } from '../engine/types.ts';
import { centered, color, fill, sprite, text } from './draw.ts';
import { BOARD, PAGE, PANEL, TILE, type Button } from './layout.ts';

const CENTRE = BOARD.w / 2;
const INK = color('ink');
const TEXT = color('text');
const MUTED = color('muted');
const GOLD = color('gold');
const LINE = color('line');

const MONSTERS = [
  { art: 'slime', name: 'SLIME', habit: 'SLOW' },
  { art: 'bat', name: 'BAT', habit: 'ERRATIC' },
  { art: 'skeleton', name: 'SKELETON', habit: 'HUNTS' },
  { art: 'warden', name: 'WARDEN', habit: 'GUARDS' },
];

function backdrop(tint: number): string {
  let ops = fill(tint, { x: 0, y: 0, w: BOARD.w, h: BOARD.h });
  for (let x = 0; x < WIDTH; x++) {
    ops += sprite('wallFace', x * TILE, 0, TILE);
    ops += sprite('wallTop', x * TILE, BOARD.h - TILE, TILE);
  }
  return ops;
}

export function titleScreen(): string {
  const monsterX = [96, 166, 352, 422];
  return [
    backdrop(INK),
    sprite('wallTorch', 3 * TILE, 0, TILE),
    sprite('wallTorch', 16 * TILE, 0, TILE),
    sprite('crown', CENTRE - 40, 306, 80),
    centered(GOLD, 'PDF DUNGEON', CENTRE, 250, 6),
    centered(MUTED, 'A DUNGEON CRAWLER THAT RUNS INSIDE THIS DOCUMENT', CENTRE, 228, 1.5),
    centered(TEXT, 'RECOVER THE ASHEN CROWN FROM FIVE FLOORS BELOW', CENTRE, 192, 1.5),
    fill(color('ember'), { x: CENTRE - 110, y: 128, w: 220, h: 42 }),
    fill(GOLD, { x: CENTRE - 110, y: 133, w: 220, h: 37 }),
    centered(INK, 'CLICK TO DESCEND', CENTRE, 146, 2),
    centered(MUTED, 'TYPE A SEED ON THE RIGHT TO REPLAY A DUNGEON', CENTRE, 100, 1.25),
    ...MONSTERS.map(({ art }, i) => sprite(art, monsterX[i]!, 32, 42)),
  ].join('');
}

export function helpScreen(): string {
  const lines = [
    'MOVE WITH ARROWS OR W A S D, OR THE ON-PAGE PAD.',
    'WALK INTO MONSTERS TO STRIKE THEM.',
    'EVERY TURN YOU TAKE, THE DUNGEON TAKES ONE TOO.',
    'BRASS KEYS OPEN LOCKED DOORS. STAIRS LEAD DOWN.',
    'SPACE WAITS. Q DRINKS A POTION (+6 HEALTH).',
    'SLIMES ARE SLOW. THE WARDEN RESTS EVERY THIRD TURN.',
    'N TITLE   R RETRY SEED   P PERFORMANCE PANEL',
  ];
  return [
    backdrop(color('panel')),
    centered(GOLD, 'HOW TO PLAY', CENTRE, 350, 4),
    ...lines.map((line, i) => text(TEXT, line, 60, 316 - i * 25, 1.5)),
    ...MONSTERS.map(({ art }, i) => sprite(art, 62 + i * 115, 84, 34)),
    ...MONSTERS.map(({ name }, i) => text(MUTED, name, 62 + i * 115, 66, 1.25)),
    centered(GOLD, 'CLICK OR PRESS SPACE TO RETURN', CENTRE, 40, 1.5),
  ].join('');
}
