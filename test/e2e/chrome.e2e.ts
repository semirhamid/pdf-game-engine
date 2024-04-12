// Plays the shipped PDF in real Chrome and compares it with the same engine running in Node.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashState, newGame, step } from '../../src/engine/game.ts';
import type { Action, GameState } from '../../src/engine/types.ts';
import { BOARD } from '../../src/build/layout.ts';
import { play } from '../../tools/bot.ts';
import { findChrome, sleep } from '../../tools/chrome.ts';
import { Player } from '../../tools/player.ts';

const PDF = fileURLToPath(new URL('../../dist/game.pdf', import.meta.url));
const SHOTS = fileURLToPath(new URL('../../docs/media/', import.meta.url));
const skip = findChrome() ? false : 'Chrome not found (set CHROME_PATH)';
const ACTION: Record<string, Action> = {
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  '.': 'wait',
  q: 'potion',
};
const ARROW: Record<string, string> = {
  w: 'ArrowUp',
  a: 'ArrowLeft',
  s: 'ArrowDown',
  d: 'ArrowRight',
};

let p: Player;
const shot = async (file: string): Promise<void> => {
  const im = await p.chrome.settle();
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(SHOTS + file, im.png);
};
async function same(s: GameState, what: string): Promise<void> {
  const got = await p.expect((t) => t.hash === hashState(s));
  assert.ok(got, `${what}: telemetry not readable`);
  assert.equal(got.hash, hashState(s), what);
  assert.equal(got.turn, s.turn & 255, what);
}
// Display colour profiles shift pixels slightly when Chrome has a real window.
function assertColor(actual: number, want: number, what: string): void {
  const d = [16, 8, 0].map((b) => Math.abs(((actual >> b) & 255) - ((want >> b) & 255)));
  assert.ok(
    Math.max(...d) <= 4,
    `${what}: got #${actual.toString(16)}, want #${want.toString(16)}`,
  );
}
async function begin(seed: number): Promise<GameState> {
  await p.start(seed);
  const s = newGame(seed);
  await same(s, `start of seed ${seed}`);
  return s;
}

before(async () => {
  if (!skip) p = await Player.open(PDF);
});
after(async () => {
  if (!skip) await p.close();
});

test('boots to the title screen and hides the no-script warning', { skip }, async () => {
  await shot('title.png');
  const im = await p.chrome.screenshot();
  assertColor(p.pixel(im, BOARD.x + 5, 18), 0x0c0a14, 'warning bar hidden');
});

test('a typed seed starts exactly the dungeon Node generates', { skip }, async () => {
  await p.start(7);
  await p.key('p'); // telemetry on
  await same(newGame(7), 'seed 7');
  await p.key('n');
  await begin(42);
  await p.key('n');
});

test(
  'every input device drives the simulation: pad, arrows, WASD, space, buttons',
  { skip },
  async () => {
    const s = await begin(7);
    const act = async (a: Action, send: () => Promise<void>, what: string): Promise<void> => {
      step(s, a);
      await send();
      await same(s, what);
    };
    for (const a of ['up', 'left', 'down', 'right'] as const)
      await act(a, () => p.press(a), `pad ${a}`);
    await act('wait', () => p.press('wait'), 'pad wait');
    // Up right after Left and Down right after Right are the ones a list box can confuse.
    for (const k of [
      'ArrowLeft',
      'ArrowUp',
      'ArrowLeft',
      'ArrowLeft',
      'ArrowUp',
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
      'ArrowRight',
      'ArrowRight',
      'ArrowDown',
      'ArrowDown',
    ]) {
      await act(k.slice(5).toLowerCase() as Action, () => p.key(k), k);
    }
    for (const k of ['w', 'w', 'a', 'a', 's', 'd', 'd'])
      await act(ACTION[k]!, () => p.key(k), k);
    await act('wait', () => p.key(' '), 'space');
    await act('potion', () => p.press('potion'), 'potion button');
    await act('up', () => p.key('ArrowUp'), 'keyboard still live after a button');
    await p.key('n');
  },
);

test('keys that mean nothing leave the state and the focus alone', { skip }, async () => {
  const s = await begin(7);
  for (const k of ['Enter', 'Escape', 'x', 'z', '5']) await p.key(k);
  await sleep(200);
  await same(s, 'after junk keys');
  step(s, 'up');
  await p.key('w');
  await same(s, 'keyboard survives junk keys');
  await p.key('n');
});

test('help pauses without spending a turn; clicking returns', { skip }, async () => {
  const s = await begin(7);
  await p.key('h');
  await sleep(200);
  await shot('help.png');
  await p.clickBoard();
  await same(s, 'after help');
  step(s, 'left');
  await p.key('a');
  await same(s, 'keyboard live after help');
  await p.key('n');
});

test('a fast burst of keys loses nothing', { skip }, async () => {
  const s = await begin(11);
  const burst = play(11).inputs.slice(0, 40);
  for (const c of burst) {
    step(s, ACTION[c]!);
    await p.key(ARROW[c] ?? c);
  }
  await same(s, 'after a 40-key burst');
  await p.key('n');
});

test(
  'a complete winning run, keystroke by keystroke, matches Node at every step',
  { skip, timeout: 300_000 },
  async () => {
    const seed = 292;
    const s = await begin(seed);
    const { inputs, state } = play(seed);
    assert.equal(state.status, 'won');
    const latency: number[] = [];
    let i = 0;
    for (const c of inputs) {
      const last = hashState(s);
      step(s, ACTION[c]!);
      const t0 = performance.now();
      await p.key(i % 2 ? c : (ARROW[c] ?? c)); // alternate WASD and arrows
      const got = await p.expect((t) => t.hash === hashState(s));
      assert.equal(
        got?.hash,
        hashState(s),
        `input ${i} '${c}' on floor ${s.floor}, turn ${s.turn}`,
      );
      if (hashState(s) !== last) latency.push(performance.now() - t0);
      i++;
      if (i === 60 || (s.floor === 3 && s.turn % 40 === 0))
        await shot(i === 60 ? 'play.png' : 'play-deep.png');
    }
    assert.equal(s.status, 'won');
    await shot('victory.png');
    assertColor(
      p.pixel(await p.chrome.screenshot(), BOARD.x + 30, BOARD.y + 60),
      0x141024,
      'victory backdrop',
    );
    latency.sort((a, b) => a - b);
    const q = (f: number): string => latency[Math.floor((latency.length - 1) * f)]!.toFixed(0);
    const report = {
      chrome: p.chrome.version,
      headful: !!process.env['HEADFUL'],
      inputs: inputs.length,
      medianMs: +q(0.5),
      p95Ms: +q(0.95),
      maxMs: +q(1),
    };
    console.log(
      'key -> decoded pixels (includes screenshot + PNG decode):',
      JSON.stringify(report),
    );
    // Dismissing the result returns to the title.
    await p.key('n');
  },
);

test(
  'a losing run ends on the death screen, and retry restarts the same seed',
  { skip, timeout: 120_000 },
  async () => {
    const seed = 934;
    const s = await begin(seed);
    for (const c of play(seed).inputs) {
      step(s, ACTION[c]!);
      await p.key(c);
    }
    assert.equal(s.status, 'dead');
    await same(s, 'death');
    await shot('death.png');
    assertColor(
      p.pixel(await p.chrome.screenshot(), BOARD.x + 30, BOARD.y + 60),
      0x1c0a14,
      'death backdrop',
    );
    await p.key('w');
    await same(s, 'dead heroes do not walk');
    await p.key('r');
    await same(newGame(seed), 'retry');
  },
);
