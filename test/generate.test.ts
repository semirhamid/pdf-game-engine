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
