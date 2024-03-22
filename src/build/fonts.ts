import { dim, rgb } from '../art/palette.ts';
import { ADVANCE, GLYPH_H, GLYPH_W, inkRuns, PIXEL_FONT } from '../art/pixelfont.ts';
import { silhouette, SPRITES, type Grid } from '../art/sprites.ts';
import { TERRAIN } from '../art/terrain.ts';
import { ACTOR, TILE, TILE_DIM } from '../art/tiles.ts';
import { glyphName } from './glyphnames.ts';
import { name, PdfDocument, type Dict, type PdfValue, type Ref } from './pdf.ts';

// The sprites are shipped as Type 3 fonts. A Type 3 glyph is a little drawing program, and after
// the d0 operator it picks its own colours, so typing a character draws a full-colour tile.

interface Glyph {
  ch: string;
  ops: string;
}

// Turns pixels into filled rectangles, most common colour first.
export function gridToOps(grid: Grid, size = 16): string {
  const counts = new Map<number, number>();
  let opaque = true;
  for (const pixel of grid.flat()) {
    if (pixel === null) opaque = false;
    else counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
  }
  const colors = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a - b);

  return colors
    .map((hex, i) => {
      // Filling the whole tile first avoids hairline gaps between rectangles.
      if (opaque && i === 0) return `${rgb(hex)} rg\n0 0 ${size} ${size} re f\n`;
      return `${rgb(hex)} rg\n${rectangles(grid, hex, size)}f\n`;
    })
    .join('');
}

// Greedy merge: grow each rectangle right, then down, as far as the colour goes.
function rectangles(grid: Grid, hex: number, size: number): string {
  const left = grid.map((row) => row.map((pixel) => pixel === hex));
  let out = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!left[y]![x]) continue;
      let w = 1;
      while (x + w < size && left[y]![x + w]) w++;
      let h = 1;
      while (y + h < size && left[y + h]!.slice(x, x + w).every(Boolean)) h++;
      for (let row = y; row < y + h; row++) left[row]!.fill(false, x, x + w);
      out += `${x} ${size - y - h} ${w} ${h} re\n`;
    }
  }
  return out;
}

// PDFium needs this to find Type 3 glyphs at all. Without it every character silently falls
// back to Helvetica.
function toUnicode(doc: PdfDocument, fontName: string): Ref {
  return doc.stream(`/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /${fontName} def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
1 beginbfrange
<20> <7E> <0020>
endbfrange
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`);
}

function type3(
  doc: PdfDocument,
  fontName: string,
  width: number,
  height: number,
  glyphs: Glyph[],
  bottom = 0,
): Ref {
  const procs: Dict = {};
  const differences: PdfValue[] = [];
  const sorted = [...glyphs].sort((a, b) => a.ch.charCodeAt(0) - b.ch.charCodeAt(0));
  for (const { ch, ops } of sorted) {
    const id = glyphName(ch);
    if (procs[id]) throw new Error(`Duplicate glyph ${JSON.stringify(ch)} in ${fontName}`);
    procs[id] = doc.stream(ops, {}, true);
    differences.push(ch.charCodeAt(0), name(id));
  }
  return doc.add({
    Type: name('Font'),
    Subtype: name('Type3'),
    Name: name(fontName),
    FontBBox: [0, bottom, width, height + bottom],
    FontMatrix: [1 / height, 0, 0, 1 / height, 0, 0],
    CharProcs: procs,
    Encoding: { Type: name('Encoding'), Differences: differences },
    FirstChar: 32,
    LastChar: 126,
    Widths: Array.from({ length: 95 }, () => width),
    Resources: {},
    ToUnicode: toUnicode(doc, fontName),
  });
}

const colored = (grid: Grid) => `16 0 d0\n${gridToOps(grid)}`;
const dimmed = (grid: Grid) =>
  grid.map((row) => row.map((pixel) => (pixel === null ? null : dim(pixel))));

export function tileFont(doc: PdfDocument): Ref {
  const glyphs: Glyph[] = [];
  for (const key of Object.keys(TILE) as (keyof typeof TILE)[]) {
    const grid = TERRAIN[key];
    if (!grid) throw new Error(`No terrain art for ${key}`);
    glyphs.push({ ch: TILE[key], ops: colored(grid) });
    if (TILE_DIM[key] !== TILE[key]) {
      glyphs.push({ ch: TILE_DIM[key], ops: colored(dimmed(grid)) });
    }
  }
  return type3(doc, 'Tile', 16, 16, glyphs);
}

const PLAIN_ACTORS = [
  'hero',
  'slime',
  'bat',
  'skeleton',
  'warden',
  'key',
  'coin',
  'gem',
  'potion',
  'sword',
  'shield',
  'crown',
  'heart',
  'heartHalf',
  'heartEmpty',
] as const;
const CAN_BE_HURT = ['hero', 'slime', 'bat', 'skeleton', 'warden'] as const;

export function actorFont(doc: PdfDocument): Ref {
  const glyphs: Glyph[] = [{ ch: ACTOR.none, ops: '16 0 d0\n' }];
  for (const key of PLAIN_ACTORS) {
    glyphs.push({ ch: ACTOR[key], ops: colored(SPRITES[key]!) });
  }
  for (const key of CAN_BE_HURT) {
    const flash = key === 'hero' ? 0xd8394f : 0xfff4e0;
    glyphs.push({ ch: ACTOR[`${key}Hurt`], ops: colored(silhouette(SPRITES[key]!, flash)) });
  }
  glyphs.push({ ch: ACTOR.bitOff, ops: '16 0 d0 0 g 0 0 16 16 re f\n' });
  glyphs.push({ ch: ACTOR.bitOn, ops: '16 0 d0 1 g 0 0 16 16 re f\n' });
  return type3(doc, 'Actor', 16, 16, glyphs);
}

// Text glyphs use d1 instead of d0, which leaves the colour to the field.
export function textFont(doc: PdfDocument): Ref {
  const start = `${ADVANCE} 0 0 0 ${GLYPH_W} ${GLYPH_H} d1\n`;
  const glyphs: Glyph[] = [{ ch: ' ', ops: start }];
  for (const ch of Object.keys(PIXEL_FONT)) {
    const rects = inkRuns(ch).map(({ x, y, length }) => `${x} ${y} ${length} 1 re\n`);
    const ops = `${start}${rects.join('')}f\n`;
    glyphs.push({ ch, ops });
    if (/[A-Z]/.test(ch)) glyphs.push({ ch: ch.toLowerCase(), ops });
  }
  return type3(doc, 'Pixel', ADVANCE, GLYPH_H + 2, glyphs, -1);
}
