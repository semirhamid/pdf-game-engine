// 5x7 letters. Each row is a 5-bit mask in hex, top row first.
const RAW: Record<string, string> = {
  A: '0E 11 11 1F 11 11 11',
  B: '1E 11 11 1E 11 11 1E',
  C: '0E 11 10 10 10 11 0E',
  D: '1E 11 11 11 11 11 1E',
  E: '1F 10 10 1E 10 10 1F',
  F: '1F 10 10 1E 10 10 10',
  G: '0E 11 10 17 11 11 0E',
  H: '11 11 11 1F 11 11 11',
  I: '0E 04 04 04 04 04 0E',
  J: '07 02 02 02 02 12 0C',
  K: '11 12 14 18 14 12 11',
  L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11',
  N: '11 19 15 13 11 11 11',
  O: '0E 11 11 11 11 11 0E',
  P: '1E 11 11 1E 10 10 10',
  Q: '0E 11 11 11 15 12 0D',
  R: '1E 11 11 1E 14 12 11',
  S: '0F 10 10 0E 01 01 1E',
  T: '1F 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0E',
  V: '11 11 11 11 11 0A 04',
  W: '11 11 11 15 15 1B 11',
  X: '11 11 0A 04 0A 11 11',
  Y: '11 11 0A 04 04 04 04',
  Z: '1F 01 02 04 08 10 1F',
  0: '0E 11 13 15 19 11 0E',
  1: '04 0C 04 04 04 04 0E',
  2: '0E 11 01 06 08 10 1F',
  3: '1E 01 01 0E 01 01 1E',
  4: '02 06 0A 12 1F 02 02',
  5: '1F 10 1E 01 01 11 0E',
  6: '06 08 10 1E 11 11 0E',
  7: '1F 01 02 04 08 08 08',
  8: '0E 11 11 0E 11 11 0E',
  9: '0E 11 11 0F 01 02 0C',
  '.': '00 00 00 00 00 0C 0C',
  ',': '00 00 00 00 0C 04 08',
  '!': '04 04 04 04 04 00 04',
  '?': '0E 11 01 06 04 00 04',
  ':': '00 0C 0C 00 0C 0C 00',
  '-': '00 00 00 0E 00 00 00',
  '+': '00 04 04 1F 04 04 00',
  '/': '01 01 02 04 08 10 10',
  '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08',
  "'": '04 04 08 00 00 00 00',
  '=': '00 00 1F 00 1F 00 00',
  '#': '0A 0A 1F 0A 1F 0A 0A',
  '*': '00 15 0E 1F 0E 15 00',
  '%': '18 19 02 04 08 13 03',
  '<': '02 04 08 10 08 04 02',
  '>': '08 04 02 01 02 04 08',
  _: '00 00 00 00 00 00 1F',
  '|': '04 04 04 04 04 04 04',
  '&': '0C 12 14 08 15 12 0D',
};

export const PIXEL_FONT: Record<string, number[]> = {};
for (const ch of Object.keys(RAW))
  PIXEL_FONT[ch] = RAW[ch]!.split(' ').map((h) => parseInt(h, 16));

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const ADVANCE = 6;

export interface Run {
  x: number;
  y: number; // from the baseline
  length: number;
}

// Horizontal strokes of a letter. Unknown characters have none.
export function inkRuns(ch: string): Run[] {
  const runs: Run[] = [];
  (PIXEL_FONT[ch] ?? []).forEach((mask, row) => {
    for (let x = 0; x < GLYPH_W; x++) {
      const inked = (column: number) => column < GLYPH_W && (mask & (16 >> column)) !== 0;
      if (!inked(x)) continue;
      let length = 1;
      while (inked(x + length)) length++;
      runs.push({ x, y: GLYPH_H - 1 - row, length });
      x += length;
    }
  });
  return runs;
}

// Text as PDF rectangles, for art that never changes. (x, y) is the left end of the baseline.
export function textRects(text: string, x: number, y: number, pixel: number): string {
  const round = (n: number) => +n.toFixed(3);
  let out = '';
  text
    .toUpperCase()
    .split('')
    .forEach((ch, i) => {
      for (const run of inkRuns(ch)) {
        const left = round(x + (i * ADVANCE + run.x) * pixel);
        const bottom = round(y + run.y * pixel);
        out += `${left} ${bottom} ${round(run.length * pixel)} ${pixel} re `;
      }
    });
  return out ? out + 'f\n' : '';
}

export function textWidth(text: string, pixel: number): number {
  return (text.length * ADVANCE - 1) * pixel;
}
