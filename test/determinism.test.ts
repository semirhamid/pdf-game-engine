import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashState, newGame, replay, step } from '../src/engine/game.ts';
import { int, makeRng, next, shuffle } from '../src/engine/rng.ts';
import { play } from '../tools/bot.ts';

test('the RNG matches pinned values', () => {
  const r = makeRng(1);
  assert.deepEqual([next(r), next(r), next(r)], PINNED_RNG);
  assert.ok(makeRng(0).s !== 0, 'xorshift must never reach the zero state');
  for (let i = 0; i < 1000; i++) assert.ok(int(r, 7) < 7);
  assert.deepEqual(shuffle(makeRng(3), [1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
});

test('same seed and inputs give the same state at every step', () => {
  const { inputs } = play(11);
  const a = newGame(11);
  const b = newGame(11);
  for (const c of inputs) {
    const action = (
      { w: 'up', a: 'left', s: 'down', d: 'right', '.': 'wait', q: 'potion' } as const
    )[c as 'w'];
    step(a, action);
    step(b, action);
    assert.equal(hashState(a), hashState(b));
  }
});

test('golden replays: full-run hashes do not drift', () => {
  for (const [seed, status, hash] of GOLDEN) {
    const { state, inputs } = play(seed);
    assert.equal(state.status, status, `seed ${seed}`);
    assert.equal(hashState(state), hash, `seed ${seed}`);
    assert.equal(
      hashState(replay(seed, inputs)),
      hash,
      'replaying the recorded inputs reproduces the run',
    );
  }
});

test('the hash notices small differences', () => {
  const base = hashState(newGame(5));
  const tweak = (f: (s: ReturnType<typeof newGame>) => void): number => {
    const s = newGame(5);
    f(s);
    return hashState(s);
  };
  for (const h of [
    tweak((s) => {
      s.player.hp--;
    }),
    tweak((s) => {
      s.enemies[0]!.x++;
    }),
    tweak((s) => {
      s.rng.s++;
    }),
    tweak((s) => {
      s.explored[0] = !s.explored[0];
    }),
  ]) {
    assert.notEqual(h, base);
  }
});

test('no run gets stuck, and balance stays within bounds', () => {
  let won = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const { state } = play(seed);
    assert.notEqual(state.status, 'playing', `seed ${seed} never finished`);
    if (state.status === 'won') won++;
  }
  assert.ok(won > 180 && won < 270, `bot won ${won}/300`);
});

// Recorded from a known good version. If these change, old replays no longer work.
const PINNED_RNG: number[] = [2005365029, 2916098932, 2657092299];
const GOLDEN: [number, string, number][] = [
  [1, 'dead', 543899944],
  [7, 'won', 3341290350],
  [42, 'won', 2374885739],
  [292, 'won', 786061051],
  [934, 'dead', 1595869241],
];
