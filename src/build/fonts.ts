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
