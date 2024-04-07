import { HEIGHT, WIDTH } from '../engine/types.ts';
import { F, KEY_OPTIONS, KEY_REST, MESSAGE_LINES } from '../runtime/fields.ts';
import { rgb } from '../art/palette.ts';
import { bundleRuntime } from './bundle.ts';
import { color } from './draw.ts';
import { actorFont, textFont, tileFont } from './fonts.ts';
import { BITS, BOARD, BUTTONS, LAMP, PAGE, PANEL, SEED, TILE, type Box } from './layout.ts';
import { name, PdfDocument, type Dict } from './pdf.ts';
import {
  buttonFace,
  deathScreen,
  helpScreen,
  noScriptWarning,
  pageArt,
  titleScreen,
  victoryScreen,
} from './screens.ts';
import { COMB, HIDDEN, js, NO_SPELL_CHECK, PRINT, READ_ONLY, Widgets } from './widgets.ts';

const TEXT_SIZE = 13.5; // 1.5pt per pixel of the typeface

// The order widgets are added in matters. PDFium paints them in order, gives a click to the
// first visible writable one, and gives mouse-enter to the first one of any kind. A button that
// misses mouse-enter can't take focus, so the board button must come before the read-only rows
// it covers. The focused widget is the exception: painted last, clicked first.
function addInput(widgets: Widgets): void {
  widgets.add(F.seedInput, SEED, {
    FT: name('Tx'),
    V: '',
    MaxLen: 16,
    Q: 1,
    Ff: NO_SPELL_CHECK,
    DA: `/Cour 13 Tf ${rgb(color('text'))} rg`,
    MK: { BG: [0.2, 0.17, 0.29] },
  });

  // It's focused during play and so painted on top of everything. Keep it small and let it
  // double as the lamp next to the keyboard status.
  const invisible = rgb(color('panel'));
  widgets.add(F.keyboard, LAMP, {
    FT: name('Ch'),
    Ff: 0,
    Opt: KEY_OPTIONS,
    V: KEY_OPTIONS[KEY_REST]!,
    I: [KEY_REST],
    DA: `/Cour 5 Tf ${invisible} rg`,
    AA: { K: js('PD.key(event)'), Fo: js('PD.focus(true)'), Bl: js('PD.focus(false)') },
  });
  widgets.add(
    F.sink,
    { x: LAMP.x + 2, y: LAMP.y + 2, w: 1, h: 1 },
    { FT: name('Tx'), V: '', DA: `/Cour 1 Tf ${invisible} rg` },
  );
  widgets.button(F.board, BOARD, 'PD.button("board")', '');
}

function addBoard(widgets: Widgets): void {
  const rows: Box[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    rows.push({ x: BOARD.x, y: BOARD.y + (HEIGHT - 1 - y) * TILE, w: BOARD.w, h: TILE });
  }
  rows.forEach((box, y) => widgets.label(F.terrain + y, box, 'Tile', TILE));
  rows.forEach((box, y) => widgets.label(F.actor + y, box, 'Actor', TILE));
  rows.forEach((box, y) =>
    widgets.label(F.ascii + y, box, 'Cour', 20, 'text', {
      Ff: READ_ONLY | COMB | NO_SPELL_CHECK,
      MaxLen: WIDTH,
    }),
  );
}
