import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateLevel } from '../src/engine/generate.ts';
import { isSolvable } from '../src/engine/solver.ts';
import {
  at,
  FLOORS,
  HEIGHT,
  T_FLOOR,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  WIDTH,
  type Level,
} from '../src/engine/types.ts';

const SEEDS = 400;
function each(f: (l: Level, floor: number, seed: number) => void): void {
  for (let seed = 1; seed <= SEEDS; seed++)
    for (let floor = 1; floor <= FLOORS; floor++) f(generateLevel(seed, floor), floor, seed);
}

// A second solver, so a bug in the first can't hide: searches cell, doors opened and keys taken.
function exhaustiveReach(l: Level): boolean {
  const locks = l.terrain.flatMap((t, i) => (t === T_LOCKED ? [i] : []));
  const keys = l.items.filter((i) => i.kind === 'key').map((i) => at(i.x, i.y));
  const bits = (n: number): number => n.toString(2).replace(/0/g, '').length;
  const seen = new Set<string>();
  const stack: [number, number, number][] = [[at(l.start.x, l.start.y), 0, 0]];
  while (stack.length) {
    let [c, opened, taken] = stack.pop()!;
    const k = keys.indexOf(c);
    if (k >= 0) taken |= 1 << k;
    const id = `${c},${opened},${taken}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (c === at(l.goal.x, l.goal.y)) return true;
    for (const d of [1, -1, WIDTH, -WIDTH]) {
      const n = c + d;
      if (l.terrain[n] === T_WALL) continue;
      const li = locks.indexOf(n);
      if (li >= 0 && !(opened & (1 << li))) {
        if (bits(taken) > bits(opened)) stack.push([n, opened | (1 << li), taken]);
      } else stack.push([n, opened, taken]);
    }
  }
  return false;
}

test('levels are 20x15 with a solid border', () => {
  each((l) => {
    assert.equal(l.terrain.length, WIDTH * HEIGHT);
    for (let x = 0; x < WIDTH; x++) {
      assert.equal(l.terrain[at(x, 0)], T_WALL);
      assert.equal(l.terrain[at(x, HEIGHT - 1)], T_WALL);
    }
    for (let y = 0; y < HEIGHT; y++) {
      assert.equal(l.terrain[at(0, y)], T_WALL);
      assert.equal(l.terrain[at(WIDTH - 1, y)], T_WALL);
    }
  });
});

test('the goal of every level is reachable (two independent solvers)', () => {
  each((l, floor, seed) => {
    assert.ok(isSolvable(l), `solver: seed ${seed} floor ${floor}`);
    assert.ok(exhaustiveReach(l), `exhaustive: seed ${seed} floor ${floor}`);
  });
});

test('no order of spending keys can strand the player', () => {
  // Only one lock should be reachable at a time.
  each((l, floor, seed) => {
    const locks = l.terrain.filter((t) => t === T_LOCKED).length;
    assert.equal(
      l.items.filter((i) => i.kind === 'key').length,
      locks,
      `seed ${seed} floor ${floor}`,
    );
    const t = l.terrain.slice();
    for (let opened = 0; opened < locks; opened++) {
      const seen = new Set([at(l.start.x, l.start.y)]);
      const frontier = new Set<number>();
      for (const c of seen)
        for (const d of [1, -1, WIDTH, -WIDTH]) {
          if (t[c + d] === T_LOCKED) frontier.add(c + d);
          else if (t[c + d] !== T_WALL) seen.add(c + d);
        }
      assert.equal(frontier.size, 1, `seed ${seed} floor ${floor}: ambiguous lock`);
      t[[...frontier][0]!] = T_FLOOR;
    }
  });
});

test('locks matter: removing every key makes the level unsolvable', () => {
  each((l, floor, seed) => {
    const stripped = { ...l, items: l.items.filter((i) => i.kind !== 'key') };
    assert.equal(isSolvable(stripped), false, `seed ${seed} floor ${floor}`);
  });
});

test('objects stand on distinct floor cells and monsters keep their distance from the start', () => {
  each((l, floor) => {
    const taken = new Set([at(l.start.x, l.start.y)]);
    for (const o of [...l.items, ...l.enemies]) {
      const c = at(o.x, o.y);
      assert.equal(l.terrain[c], T_FLOOR);
      assert.ok(!taken.has(c), 'overlap');
      taken.add(c);
    }
    for (const e of l.enemies)
      assert.ok(Math.abs(e.x - l.start.x) + Math.abs(e.y - l.start.y) >= 5);
    assert.equal(l.terrain.filter((t) => t === T_STAIRS).length, floor === FLOORS ? 0 : 1);
    assert.equal(l.items.filter((i) => i.kind === 'crown').length, floor === FLOORS ? 1 : 0);
    assert.equal(l.enemies.filter((e) => e.kind === 'warden').length, floor === FLOORS ? 1 : 0);
  });
});

test('difficulty rises: later floors hold at least as much monster health', () => {
  const total = (f: number): number => {
    let n = 0;
    for (let s = 1; s <= 100; s++)
      n += generateLevel(s, f).enemies.reduce((a, e) => a + e.hp, 0);
    return n;
  };
  for (let f = 2; f <= FLOORS; f++) assert.ok(total(f) >= total(f - 1), `floor ${f}`);
});

test('generation is a pure function of (seed, floor)', () => {
  for (const seed of [1, 99, -5, 2147483647])
    assert.deepEqual(generateLevel(seed, 3), generateLevel(seed, 3));
  assert.notDeepEqual(generateLevel(1, 1).terrain, generateLevel(2, 1).terrain);
  assert.notDeepEqual(generateLevel(1, 1).terrain, generateLevel(1, 2).terrain);
});
