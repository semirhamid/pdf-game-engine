import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp, type Host } from '../src/runtime/app.ts';
import { F, KEY_OPTIONS, KEY_REST } from '../src/runtime/fields.ts';
import { intentFromButton, intentFromListBox, parseSeed } from '../src/runtime/input.ts';
import { createRenderer } from '../src/runtime/renderer.ts';
import {
  actorCells,
  asciiRow,
  hearts,
  telemetryBits,
  terrainRow,
} from '../src/runtime/scene.ts';
import { hashState, newGame } from '../src/engine/game.ts';
import { HEIGHT, WIDTH } from '../src/engine/types.ts';
import { TILE, TILE_DIM, ACTOR } from '../src/art/tiles.ts';
import { play } from '../tools/bot.ts';

function fakeHost(mode: 'tiles' | 'ascii' = 'tiles'): Host & {
  values: Record<string, string>;
  visible: Record<string, boolean>;
  writes: string[];
  focuses: number;
  settles: number;
  seed: string;
} {
  let clock = 0;
  const h = {
    mode,
    values: {} as Record<string, string>,
    visible: {} as Record<string, boolean>,
    writes: [] as string[],
    focuses: 0,
    settles: 0,
    seed: '7',
    setValue(f: string, v: string): void {
      h.values[f] = v;
      h.writes.push(f);
    },
    setVisible(f: string, v: boolean): void {
      h.visible[f] = v;
      h.writes.push(f);
    },
    now: (): number => ++clock,
    readSeed: (): string => h.seed,
    focusKeyboard(): void {
      h.focuses++;
    },
    scheduleSettle(): void {
      h.settles++;
    },
  };
  return h;
}

test('renderer writes only differences', () => {
  const log: string[] = [];
  const r = createRenderer({
    setValue: (f, v) => log.push(`${f}=${v}`),
    setVisible: (f, v) => log.push(`${f}:${v}`),
  });
  r.draw({ values: { a: '1', b: '2' }, visible: { o: true } });
  assert.deepEqual(log.splice(0), ['a=1', 'b=2', 'o:true']);
  assert.deepEqual(r.draw({ values: { a: '1', b: '3' }, visible: { o: true } }), {
    writes: 1,
    total: 3,
  });
  assert.deepEqual(log.splice(0), ['b=3']);
  assert.equal(r.draw({ values: { a: '1', b: '3' }, visible: { o: true } }).writes, 0);
  r.invalidate();
  assert.equal(r.draw({ values: { a: '1', b: '3' }, visible: { o: true } }).writes, 3);
});

test('a typical turn touches a small fraction of the fields', () => {
  const host = fakeHost();
  const app = createApp(host);
  app.boot();
  app.intent('confirm');
  const { inputs } = play(7);
  const map = { w: 'up', a: 'left', s: 'down', d: 'right', '.': 'wait', q: 'potion' } as const;
  let total = 0;
  for (const c of inputs) {
    host.writes.length = 0;
    app.intent(map[c as 'w']);
    total += host.writes.length;
  }
  const average = total / inputs.length;
  assert.ok(average < 12, `average writes per turn: ${average.toFixed(1)}`);
});

test('list-box labels map to intents and the rest position is safe', () => {
  assert.equal(intentFromListBox(KEY_OPTIONS[0]!), 'left');
  assert.equal(intentFromListBox(KEY_OPTIONS[KEY_OPTIONS.length - 1]!), 'right');
  assert.equal(intentFromListBox(KEY_OPTIONS[KEY_REST - 1]!), 'up');
  assert.equal(intentFromListBox(KEY_OPTIONS[KEY_REST + 1]!), 'down');
  assert.equal(intentFromListBox(KEY_OPTIONS[KEY_REST]!), null);
  for (const [k, v] of [
    ['w', 'up'],
    ['a', 'left'],
    ['s', 'down'],
    ['d', 'right'],
    ['q', 'potion'],
    [' ', 'confirm'],
  ])
    assert.equal(intentFromListBox(k!), v);
  for (const junk of ['', 'zz', 'undefined', '7']) assert.equal(intentFromListBox(junk), null);
  assert.equal(new Set(KEY_OPTIONS).size, KEY_OPTIONS.length);
  for (const o of KEY_OPTIONS) assert.equal(o.length, 1, 'options match by first character');
  assert.equal(intentFromButton('nope'), null);
});

test('seed parsing is total and never yields zero', () => {
  assert.equal(parseSeed('42', 0), 42);
  assert.equal(parseSeed('  42 ', 0), 42);
  assert.equal(parseSeed('hello', 0), parseSeed('HELLO', 5));
  for (const t of ['', '0', 'x', '99999999999999', '   ']) {
    const v = parseSeed(t, 1764000000000);
    assert.ok(v > 0 && v === (v | 0));
  }
});

test('scene rows have fixed width and use only known glyphs', () => {
  const s = newGame(3);
  const actors = actorCells(s, []);
  const known = new Set([...Object.values(TILE), ...Object.values(TILE_DIM)]);
  for (let y = 0; y < HEIGHT; y++) {
    const row = terrainRow(s, y);
    assert.equal(row.length, WIDTH);
    for (const c of row) assert.ok(known.has(c as never));
    assert.equal(asciiRow(s, actors, y).length, WIDTH);
  }
  assert.equal(
    [...Array(HEIGHT).keys()]
      .map((y) => asciiRow(s, actors, y))
      .join('')
      .split('@').length,
    2,
  );
});

test('hearts show whole, half and empty', () => {
  const { heart: f, heartHalf: h, heartEmpty: e } = ACTOR;
  assert.equal(hearts(12, 12), f.repeat(6));
  assert.equal(hearts(3, 12), f + h + e.repeat(4));
  assert.equal(hearts(0, 12), e.repeat(6));
});

test('telemetry encodes the state hash', () => {
  const s = newGame(9);
  const bits = telemetryBits(s)
    .split('')
    .map((c) => (c === ACTOR.bitOn ? '1' : '0'))
    .join('');
  assert.equal(bits.length, 44);
  assert.equal(bits.slice(0, 4), '1010');
  assert.equal(parseInt(bits.slice(4, 36), 2), hashState(s));
});

test('screen flow: title -> play -> help -> play -> title', () => {
  const host = fakeHost();
  const app = createApp(host);
  const screen = (): string => app.snapshot().ui.screen;
  app.boot();
  assert.equal(host.visible[F.title], true);
  app.intent('up');
  assert.equal(screen(), 'title', 'movement does nothing on the title');
  app.intent('confirm');
  assert.equal(screen(), 'playing');
  assert.equal(host.visible[F.title], false);
  assert.ok(host.focuses > 0);
  assert.equal(app.snapshot().hash, hashState(newGame(7)));
  app.intent('help');
  assert.equal(host.visible[F.help], true);
  const frozen = app.snapshot().hash;
  app.intent('right');
  assert.equal(screen(), 'playing');
  assert.equal(app.snapshot().hash, frozen, 'dismissing help costs no turn');
  app.intent('new');
  assert.equal(screen(), 'title');
});

test('death and victory screens, retry and best score', () => {
  const map = { w: 'up', a: 'left', s: 'down', d: 'right', '.': 'wait', q: 'potion' } as const;
  for (const [seed, want] of [
    [934, 'dead'],
    [292, 'won'],
  ] as const) {
    const host = fakeHost();
    host.seed = String(seed);
    const app = createApp(host);
    app.boot();
    app.intent('confirm');
    for (const c of play(seed).inputs) app.intent(map[c as 'w']);
    assert.equal(app.snapshot().ui.screen, want);
    assert.equal(host.visible[want === 'dead' ? F.dead : F.won], true);
    assert.match(host.values[F.result1]!, /^SCORE \d+/);
    const final = app.snapshot().state!.score;
    app.intent('up');
    assert.equal(app.snapshot().ui.screen, want, 'movement cannot dismiss the result');
    app.intent('retry');
    assert.equal(app.snapshot().hash, hashState(newGame(seed)));
    assert.equal(host.values[F.best], 'BEST ' + final);
  }
});

test('hit flashes are scheduled and then cleared', () => {
  const host = fakeHost();
  host.seed = '7';
  const app = createApp(host);
  app.boot();
  app.intent('confirm');
  const map = { w: 'up', a: 'left', s: 'down', d: 'right', '.': 'wait', q: 'potion' } as const;
  const hurt = /[HSBKD]/;
  const actors = (): string =>
    [...Array(HEIGHT).keys()].map((y) => host.values[F.actor + y]).join('');
  let seen = false;
  for (const c of play(7).inputs) {
    app.intent(map[c as 'w']);
    if (hurt.test(actors())) {
      seen = true;
      assert.ok(host.settles > 0);
      app.settle();
      assert.ok(!hurt.test(actors()));
    }
  }
  assert.ok(seen);
});

test('ascii mode draws one combined layer and no sprite glyphs', () => {
  const host = fakeHost('ascii');
  const app = createApp(host);
  app.boot();
  app.intent('confirm');
  assert.equal(host.values[F.terrain + 5], '');
  assert.equal(host.values[F.hearts], '');
  assert.ok([...Array(HEIGHT).keys()].some((y) => host.values[F.ascii + y]!.includes('@')));
});
