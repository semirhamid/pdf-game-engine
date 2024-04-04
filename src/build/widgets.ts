import { rgb } from '../art/palette.ts';
import { color } from './draw.ts';
import type { Box } from './layout.ts';
import { formatNumber as num, name, PdfDocument, type Dict, type Ref } from './pdf.ts';

// Field flags (PDF 1.7, 12.7.4) and annotation flags (12.5.3).
export const READ_ONLY = 1;
export const PUSH_BUTTON = 1 << 16;
export const NO_SPELL_CHECK = 1 << 22;
export const NO_SCROLL = 1 << 23;
export const COMB = 1 << 24;
export const HIDDEN = 2;
export const PRINT = 4;

export function js(code: string): Dict {
  return { S: name('JavaScript'), JS: code };
}

export class Widgets {
  readonly refs: Ref[] = [];
  private readonly doc: PdfDocument;
  private readonly page: Ref;

  constructor(doc: PdfDocument, page: Ref) {
    this.doc = doc;
    this.page = page;
  }

  add(field: string, box: Box, entries: Dict): void {
    this.refs.push(
      this.doc.add({
        Type: name('Annot'),
        Subtype: name('Widget'),
        T: field,
        F: PRINT,
        P: this.page,
        Rect: [box.x, box.y, box.x + box.w, box.y + box.h],
        BS: { W: 0 },
        ...entries,
      }),
    );
  }

  drawing(ops: string, box: Box): Ref {
    return this.doc.stream(
      ops,
      {
        Type: name('XObject'),
        Subtype: name('Form'),
        BBox: [0, 0, box.w, box.h],
        Resources: {},
      },
      true,
    );
  }

  label(
    field: string,
    box: Box,
    font: string,
    size: number,
    colorName = 'text',
    extra: Dict = {},
  ): void {
    this.add(field, box, {
      FT: name('Tx'),
      Ff: READ_ONLY | NO_SPELL_CHECK | NO_SCROLL,
      V: '',
      DA: `/${font} ${num(size)} Tf ${rgb(color(colorName))} rg`,
      ...extra,
    });
  }

  // Without a pressed drawing the button looks the same when held down.
  button(
    field: string,
    box: Box,
    action: string,
    face: string,
    pressed?: string,
    flags = PRINT,
  ): void {
    const normal = this.drawing(face, box);
    const down = pressed === undefined ? normal : this.drawing(pressed, box);
    this.add(field, box, {
      FT: name('Btn'),
      Ff: PUSH_BUTTON,
      H: name('P'),
      F: flags,
      AP: { N: normal, D: down },
      AA: { U: js(action) },
    });
  }
}
