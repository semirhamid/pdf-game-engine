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

function endScreen(
  tint: number,
  art: string,
  title: string,
  hex: number,
  line: string,
): string {
  return [
    backdrop(tint),
    sprite(art, CENTRE - 48, 280, 96),
    centered(hex, title, CENTRE, 222, 6),
    centered(TEXT, line, CENTRE, 190, 1.5),
    centered(GOLD, 'CLICK OR SPACE: TITLE     R: RETRY THIS SEED', CENTRE, 60, 1.5),
  ].join('');
}

export function deathScreen(): string {
  const line = 'THE DUNGEON KEEPS WHAT IT TAKES.';
  return endScreen(0x1c0a14, 'skeleton', 'YOU DIED', color('blood'), line);
}

export function victoryScreen(): string {
  const line = 'THE ASHEN CROWN IS YOURS. THE PAGE IS SILENT.';
  return endScreen(0x141024, 'crown', 'CROWNED', GOLD, line);
}

export function noScriptWarning(width: number, height: number): string {
  const message = 'PDF JAVASCRIPT IS NOT RUNNING HERE - OPEN THIS FILE IN CHROME';
  return (
    fill(color('ember'), { x: 0, y: 0, w: width, h: height }) +
    centered(INK, message, width / 2, 8, 1.5)
  );
}

const ARROWS: Record<string, string> = {
  up: '15 12 m 23 26 l 31 12 l f',
  down: '15 26 m 31 26 l 23 12 l f',
  left: '30 11 m 30 27 l 16 19 l f',
  right: '16 11 m 16 27 l 30 19 l f',
};

export function buttonFace(id: string, button: Button, pressed: boolean): string {
  const { w, h, label } = button;
  const base = pressed ? scale(LINE, 1.5) : LINE;
  const pixel = w < 60 ? 1.25 : 1.5;

  let ops = fill(scale(base, 0.5), { x: 0, y: 0, w, h });
  ops += fill(base, { x: 0, y: pressed ? 0 : 3, w, h: h - 3 });
  if (!pressed) ops += fill(scale(base, 1.35), { x: 0, y: h - 2, w, h: 2 });
  const arrow = ARROWS[id];
  ops += arrow ? `${rgb(GOLD)} rg ${arrow}\n` : centered(TEXT, label, w / 2, h / 2 - 4, pixel);
  return ops;
}

// Everything on the page that never changes.
export function pageArt(): string {
  const { x, w } = PANEL;
  const rule = (y: number) => fill(LINE, { x, y, w, h: 1 });
  return [
    fill(INK, { x: 0, y: 0, w: PAGE.w, h: PAGE.h }),
    fill(color('panel'), { x: x - 10, y: 0, w: PAGE.w - x + 10, h: PAGE.h }),
    fill(LINE, { x: BOARD.x - 2, y: BOARD.y - 2, w: BOARD.w + 4, h: BOARD.h + 4 }),
    fill(INK, BOARD),
    fill(LINE, { x: x - 10, y: 0, w: 2, h: PAGE.h }),
    text(MUTED, 'TURN-BASED. DETERMINISTIC.', BOARD.x, 480, 1),
    text(GOLD, 'PDF', x, 456, 4),
    text(TEXT, 'DUNGEON', x + 'PDF '.length * ADVANCE * 4, 456, 4),
    ...[384, 322, 276, 194].map(rule),
    sprite('sword', x, 358, 22),
    sprite('shield', x + 136, 358, 22),
    sprite('key', x, 328, 22),
    sprite('potion', x + 136, 328, 22),
    ...MONSTERS.map(({ art }, i) => sprite(art, x + 10 + i * 66, 222, 36)),
    ...MONSTERS.map(({ habit }, i) => centered(MUTED, habit, x + 28 + i * 66, 208, 1.1)),
  ].join('');
}
