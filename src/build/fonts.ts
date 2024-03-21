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
