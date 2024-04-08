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

function addHud(widgets: Widgets): void {
  const left = PANEL.x;
  const line = (field: string, x: number, y: number, w: number, colorName = 'text') =>
    widgets.label(field, { x, y, w, h: TEXT_SIZE }, 'Pixel', TEXT_SIZE, colorName);

  line(F.floor, left, 424, PANEL.w, 'gold');
  widgets.label(F.hearts, { x: left, y: 392, w: 6 * 26, h: 26 }, 'Actor', 26);
  line(F.hpText, left + 168, 398, 90);
  line(F.attack, left + 32, 362, 80);
  line(F.defence, left + 168, 362, 80);
  line(F.keys, left + 32, 332, 80);
  line(F.potions, left + 168, 332, 80);
  line(F.score, left, 302, PANEL.w, 'gold');
  line(F.best, left + 168, 302, 96, 'muted');
  line(F.seed, left, 282, PANEL.w, 'muted');
  line(F.kbStatus, left + 14, 28, 250, 'moss');
  for (let i = 0; i < MESSAGE_LINES; i++) {
    line(F.message + i, BOARD.x, 34 - i * TEXT_SIZE, BOARD.w, i === 0 ? 'text' : 'muted');
  }

  widgets.label(F.debug, { x: BOARD.x + 190, y: 479, w: 370, h: 9 }, 'Pixel', 9, 'moss');
  const strip = { x: BITS.x, y: BITS.y, w: BITS.cell * BITS.count, h: BITS.cell };
  widgets.label(F.bits, strip, 'Actor', BITS.cell);

  for (const [id, box] of Object.entries(BUTTONS)) {
    const face = buttonFace(id, box, false);
    const pressed = buttonFace(id, box, true);
    widgets.button('btn_' + id, box, `PD.button("${id}")`, face, pressed);
  }
}

function addScreens(widgets: Widgets): void {
  const screen = (field: string, art: string, flags: number) =>
    widgets.button(field, BOARD, 'PD.button("start")', art, undefined, flags);

  screen(F.title, titleScreen(), PRINT);
  screen(F.help, helpScreen(), PRINT | HIDDEN);
  screen(F.dead, deathScreen(), PRINT | HIDDEN);
  screen(F.won, victoryScreen(), PRINT | HIDDEN);

  const result = (field: string, y: number, colorName: string) => {
    const box = { x: BOARD.x + 40, y: BOARD.y + y, w: BOARD.w - 80, h: TEXT_SIZE };
    widgets.label(field, box, 'Pixel', TEXT_SIZE, colorName, { Q: 1, F: PRINT | HIDDEN });
  };
  result(F.result1, 150, 'text');
  result(F.result2, 128, 'muted');

  // The script hides this, so it only stays up in viewers that don't run it.
  const box = { x: BOARD.x, y: 14, w: BOARD.w, h: 26 };
  widgets.label(F.noScript, box, 'Pixel', TEXT_SIZE, 'ember', {
    Ff: READ_ONLY,
    AP: { N: widgets.drawing(noScriptWarning(box.w, box.h), box) },
  });
}

export function buildPdf(): Buffer {
  const doc = new PdfDocument();
  const pages = doc.reserve();
  const page = doc.reserve();
  const courier = doc.add({
    Type: name('Font'),
    Subtype: name('Type1'),
    BaseFont: name('Courier-Bold'),
    Encoding: name('WinAnsiEncoding'),
  });
  const fonts: Dict = {
    Tile: tileFont(doc),
    Actor: actorFont(doc),
    Pixel: textFont(doc),
    Cour: courier,
  };

  const widgets = new Widgets(doc, page);
  addInput(widgets);
  addBoard(widgets);
  addHud(widgets);
  addScreens(widgets);

  // PDFium only works out a Type 3 font's height once it has seen the font used on a page, so
  // use each one invisibly (3 Tr) or the first frame comes out clipped.
  const primeFonts =
    'BT 3 Tr /Tile 8 Tf 2 2 Td ( ) Tj /Actor 8 Tf ( ) Tj /Pixel 8 Tf ( ) Tj ET\n';

  doc.set(page, {
    Type: name('Page'),
    Parent: pages,
    MediaBox: [0, 0, PAGE.w, PAGE.h],
    Contents: doc.stream(pageArt() + primeFonts, {}, true),
    Resources: { Font: fonts },
    Annots: widgets.refs,
    AA: { O: js('PD.boot()') },
  });
  doc.set(pages, { Type: name('Pages'), Count: 1, Kids: [page] });

  const script = doc.stream(bundleRuntime(), {}, true);
  const root = doc.add({
    Type: name('Catalog'),
    Pages: pages,
    PageMode: name('UseNone'),
    ViewerPreferences: { DisplayDocTitle: true, FitWindow: true },
    OpenAction: [page, name('Fit')],
    AcroForm: { Fields: widgets.refs, DR: { Font: fonts }, DA: '/Cour 10 Tf 0 g' },
    Names: { JavaScript: { Names: ['runtime', { S: name('JavaScript'), JS: script }] } },
  });
  const info = doc.add({
    Title: 'PDF DUNGEON',
    Subject: 'A playable dungeon-crawler game engine that executes inside a PDF document.',
  });
  return doc.build(root, info);
}
