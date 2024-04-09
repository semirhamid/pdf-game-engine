import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { parse } from 'acorn';
import { buildPdf } from '../src/build/page.ts';
import { gridToOps } from '../src/build/fonts.ts';
import { formatNumber, formatString, name, serialize } from '../src/build/pdf.ts';
import { F, KEY_OPTIONS, KEY_REST } from '../src/runtime/fields.ts';
import { SPRITES } from '../src/art/sprites.ts';
import { TERRAIN } from '../src/art/terrain.ts';
import { ACTOR, TILE, TILE_DIM } from '../src/art/tiles.ts';
import { hashState, newGame } from '../src/engine/game.ts';
import { telemetryBits } from '../src/runtime/scene.ts';
import { HEIGHT } from '../src/engine/types.ts';
import { readFields, readPdf } from './support/pdfread.ts';

const pdf = buildPdf();
const { objects, trailer } = readPdf(pdf);
const fields = readFields(objects);
const catalog = [...objects.values()].find((o) => o.text.includes('/Type /Catalog'))!.text;
const scriptRef = Number(
  /\/Names \[\(runtime\) << \/S \/JavaScript \/JS (\d+) 0 R/.exec(catalog)![1],
);
const script = objects.get(scriptRef)!.stream!.toString('latin1');

function contents(all: typeof objects): string[] {
  return [...all.values()].map(
    ({ text, stream }) => text.replace(/\/Length \d+/, '') + (stream?.toString('latin1') ?? ''),
  );
}

test('the file structure is valid', () => {
  assert.match(trailer, /\/Root \d+ 0 R/);
  assert.match(trailer, /\/Size \d+/);
  assert.ok(objects.size > 100);
});

test('builds are byte-for-byte reproducible', () => {
  assert.ok(buildPdf().equals(pdf));
});

// Compares decompressed contents, since zlib output can differ between machines.
test('the committed dist/game.pdf matches the source', () => {
  const committed = readPdf(readFileSync(new URL('../dist/game.pdf', import.meta.url)));
  assert.deepEqual(contents(committed.objects), contents(objects), 'run npm run build');
});

test('nothing in the file reaches outside it', () => {
  const all = [...objects.values()].map((o) => o.text).join('\n');
  for (const bad of [
    '/URI',
    '/Launch',
    '/GoToR',
    '/GoToE',
    '/SubmitForm',
    '/ImportData',
    '/EmbeddedFile',
    '/RichMedia',
    '/Filespec',
  ]) {
    assert.ok(!all.includes(bad), bad);
  }
  for (const bad of [
    'launchURL',
    'submitForm',
    'XMLHttp',
    'fetch(',
    'Net.',
    'mailDoc',
    'importText',
  ])
    assert.ok(!script.includes(bad), bad);
});

test('every field the runtime addresses exists', () => {
  const expected: string[] = [
    F.hearts,
    F.hpText,
    F.attack,
    F.defence,
    F.keys,
    F.potions,
    F.floor,
    F.score,
    F.best,
    F.seed,
    F.kbStatus,
    F.debug,
    F.bits,
    F.noScript,
    F.keyboard,
    F.sink,
    F.seedInput,
    F.board,
    F.title,
    F.help,
    F.dead,
    F.won,
    F.result1,
    F.result2,
    'm0',
    'm1',
    'm2',
  ];
  for (let y = 0; y < HEIGHT; y++) expected.push(F.terrain + y, F.actor + y, F.ascii + y);
  for (const n of expected) assert.ok(fields.has(n), `missing field ${n}`);
});

test('actions are wired to the runtime', () => {
  const action = (n: string, trigger: string): string =>
    new RegExp(`/${trigger} << /S /JavaScript /JS \\(((?:\\\\.|[^)])*)\\)`)
      .exec(fields.get(n)!.text)![1]!
      .replace(/\\(.)/g, '$1');
  for (const id of ['up', 'down', 'left', 'right', 'wait', 'potion', 'help', 'retry', 'new'])
    assert.equal(action('btn_' + id, 'U'), `PD.button("${id}")`);
  assert.equal(action(F.board, 'U'), 'PD.button("board")');
  assert.equal(action(F.keyboard, 'K'), 'PD.key(event)');
  assert.equal(action(F.keyboard, 'Fo'), 'PD.focus(true)');
  assert.equal(action(F.keyboard, 'Bl'), 'PD.focus(false)');
  assert.match(
    [...objects.values()].find((o) => /\/Type \/Page /.test(o.text))!.text,
    /\/AA << \/O << \/S \/JavaScript \/JS \(PD\.boot\\\(\\\)\) >> >>/,
  );
});

test('the keyboard is a single-select list box resting on its middle option', () => {
  const kb = fields.get(F.keyboard)!;
  assert.equal(kb.type, 'Ch');
  assert.equal(kb.flags, 0);
  assert.ok(kb.text.includes(`/I [${KEY_REST}]`));
  for (const o of KEY_OPTIONS) assert.ok(kb.text.includes(`(${o})`));
});

test('the board button comes before everything that overlaps it', () => {
  const board = fields.get(F.board)!;
  const overlaps = (a: number[], b: number[]): boolean =>
    a[0]! < b[2]! && b[0]! < a[2]! && a[1]! < b[3]! && b[1]! < a[3]!;
  for (const f of fields.values())
    if (f !== board && overlaps(f.rect, board.rect)) assert.ok(f.order > board.order, f.name);
});

test('display fields are read-only and overlays start in the right state', () => {
  for (let y = 0; y < HEIGHT; y++)
    for (const p of [F.terrain, F.actor, F.ascii])
      assert.equal(fields.get(p + y)!.flags & 1, 1);
  assert.equal(fields.get(F.title)!.annotFlags & 2, 0, 'title visible without scripts');
  for (const n of [F.help, F.dead, F.won]) assert.equal(fields.get(n)!.annotFlags & 2, 2);
  assert.equal(fields.get(F.noScript)!.annotFlags & 2, 0, 'warning visible without scripts');
});

test('Type 3 fonts have a ToUnicode map, even widths and a drawing for every glyph', () => {
  const fonts = [...objects.values()].filter((o) => o.text.includes('/Subtype /Type3'));
  assert.equal(fonts.length, 3);
  for (const f of fonts) {
    const cmap = objects
      .get(Number(/\/ToUnicode (\d+) 0 R/.exec(f.text)![1]))!
      .stream!.toString();
    assert.match(cmap, /<20> <7E> <0020>/);
    const widths = /\/Widths \[([^\]]*)\]/.exec(f.text)![1]!.split(' ');
    assert.deepEqual([widths.length, new Set(widths).size], [95, 1]);
    const procs = [.../\/CharProcs << (.*?) >>/.exec(f.text)![1]!.matchAll(/(\d+) 0 R/g)].map(
      (m) => objects.get(Number(m[1]))!.stream!.toString(),
    );
    for (const p of procs) assert.match(p, /^\d+ 0 (d0|0 0 \d+ \d+ d1)\s/);
    const codes = /\/Differences \[([^\]]*)\]/
      .exec(f.text)![1]!
      .split(' ')
      .filter((t) => /^\d+$/.test(t))
      .map(Number);
    if (f.text.includes('/Name /Tile'))
      for (const c of [...Object.values(TILE), ...Object.values(TILE_DIM)])
        assert.ok(codes.includes(c.charCodeAt(0)), c);
    if (f.text.includes('/Name /Actor'))
      for (const c of Object.values(ACTOR)) assert.ok(codes.includes(c.charCodeAt(0)), c);
  }
});

test('glyphs match the source pixels', () => {
  for (const [key, g] of [...Object.entries(SPRITES), ...Object.entries(TERRAIN)]) {
    const px: (string | null)[][] = Array.from({ length: 16 }, () =>
      Array<string | null>(16).fill(null),
    );
    let color = '';
    let rects: number[][] = [];
    for (const line of gridToOps(g).trim().split('\n')) {
      const rg = /^(.*) rg$/.exec(line);
      if (rg) {
        color = rg[1]!;
        continue;
      }
      const re = /^(\d+) (\d+) (\d+) (\d+) re/.exec(line);
      if (re) rects.push(re.slice(1, 5).map(Number));
      if (line.endsWith('f')) {
        for (const [x, y, w, h] of rects as [number, number, number, number][])
          for (let j = y; j < y + h; j++)
            for (let i = x; i < x + w; i++) px[15 - j]![i] = color;
        rects = [];
      }
    }
    g.forEach((row, y) =>
      row.forEach((c, x) => {
        const want =
          c === null
            ? null
            : [c >> 16, (c >> 8) & 255, c & 255]
                .map((v) => String(Math.round((v / 255) * 1000) / 1000))
                .join(' ');
        assert.equal(px[y]![x], want, `${key} (${x},${y})`);
      }),
    );
  }
});

test('the embedded script is pure ES5 and ASCII', () => {
  assert.doesNotThrow(() => parse(script, { ecmaVersion: 5, sourceType: 'script' }));
  assert.match(script, /^[\x00-\x7f]*$/);
});

// A stand-in for the viewer, using the field names found in the PDF.
function viewer(viewerType: string): {
  run(code: string, event?: object): void;
  doc: Record<string, any>;
  timers: string[];
} {
  const doc: Record<string, any> = {};
  let focus = '';
  for (const f of fields.values()) {
    doc[f.name] = {
      value: '',
      display: f.annotFlags & 2 ? 1 : 0,
      currentValueIndices: -1,
      setFocus(): void {
        focus = f.name;
        void focus;
      },
    };
  }
  const timers: string[] = [];
  const ctx = vm.createContext({
    app: { viewerType, setTimeOut: (c: string) => timers.push(c) },
    getField: (n: string) => doc[n] ?? null,
  });
  vm.runInContext(script, ctx);
  return {
    doc,
    timers,
    run: (code, event) => {
      (ctx as any).event = event;
      vm.runInContext(code, ctx);
    },
  };
}

test('the script extracted from the PDF plays a game (mock viewer)', () => {
  const v = viewer('pdfium');
  v.run('PD.boot()');
  assert.equal(v.doc[F.noScript].display, 1);
  v.doc[F.seedInput].value = '7';
  v.run('PD.button("board")');
  assert.equal(v.doc[F.title].display, 1);
  assert.equal(v.doc[F.seed].value, 'SEED 7');
  v.run('PD.key(event)', { change: 'p', willCommit: false });
  assert.equal(v.doc[F.bits].value, telemetryBits(newGame(7)));
  const before = v.doc[F.bits].value;
  v.run('PD.key(event)', { change: '<', willCommit: true });
  assert.equal(v.doc[F.bits].value, before, 'commits are not key presses');
  v.run('PD.key(event)', { change: '.', willCommit: false });
  assert.notEqual(v.doc[F.bits].value, before);
  assert.equal(v.doc[F.keyboard].currentValueIndices, KEY_REST);
  assert.ok(hashState(newGame(7)) !== 0);
});

test('unknown viewers fall back to the ASCII renderer (mock viewer)', () => {
  const v = viewer('Reader');
  v.run('PD.boot()');
  v.run('PD.button("board")');
  assert.equal(v.doc[F.terrain + 3].value, '');
  assert.ok([...Array(HEIGHT).keys()].some((y) => v.doc[F.ascii + y].value.includes('@')));
});

test('runtime errors are reported on the page instead of vanishing (mock viewer)', () => {
  const v = viewer('pdfium');
  v.run('PD.boot()');
  v.run('PD.button("board")');
  Object.defineProperty(v.doc[F.debug], 'value', {
    set() {
      throw new Error('boom');
    },
  });
  v.run('PD.key(event)', { change: 'p', willCommit: false });
  assert.match(v.doc['m0'].value, /ERROR.*boom/);
});

test('writer primitives', () => {
  assert.equal(formatNumber(1.5), '1.5');
  assert.equal(formatNumber(-0.00001), '0');
  assert.throws(() => formatNumber(NaN));
  assert.equal(formatString('a(b)\\'), '(a\\(b\\)\\\\)');
  assert.equal(formatString('é'), '<feff00e9>');
  assert.equal(serialize(name('A B')), '/A#20B');
  assert.equal(serialize({ K: [1, true, null] }), '<< /K [1 true null] >>');
});
