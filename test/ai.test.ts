import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceField } from '../src/engine/ai.ts';
import { step } from '../src/engine/game.ts';
import { ALERT_TURNS, START_HP } from '../src/engine/rules.ts';
import { at, HEIGHT, T_DOOR, T_FLOOR, T_WALL } from '../src/engine/types.ts';
import { arena, spawn } from './support/arena.ts';

const gap = (s: ReturnType<typeof arena>, e: { x: number; y: number }): number =>
  Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y);

test('the distance field respects walls', () => {
  const s = arena();
  for (let y = 1; y < HEIGHT - 1; y++) s.terrain[at(7, y)] = y === 12 ? T_FLOOR : T_WALL;
  const d = distanceField(s);
  assert.equal(d[at(5, 5)], 0);
  assert.equal(d[at(6, 5)], 1);
  assert.equal(d[at(8, 5)], 3 + 7 + 7, 'must detour through the gap at y=12');
  assert.equal(d[at(7, 5)], 9999);
});

test('a skeleton closes one cell per turn and strikes when adjacent', () => {
  const s = arena();
  const e = spawn(s, 'skeleton', 9, 5);
  for (const want of [3, 2, 1]) {
    step(s, 'wait');
    assert.equal(gap(s, e), want);
  }
  assert.equal(s.player.hp, START_HP);
  step(s, 'wait');
  assert.equal(s.player.hp, START_HP - 3);
});

test('a slime acts only on odd turns', () => {
  const s = arena();
  const e = spawn(s, 'slime', 9, 5);
  const gaps = [1, 2, 3, 4].map(() => {
    step(s, 'wait');
    return gap(s, e);
  });
  assert.deepEqual(gaps, [3, 3, 2, 2]);
});

test('the warden rests every third turn', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 100;
  spawn(s, 'warden', 6, 5, 9);
  const damage = [1, 2, 3, 4, 5, 6].map(() => {
    const hp = s.player.hp;
    step(s, 'wait');
    return hp - s.player.hp;
  });
  assert.deepEqual(damage, [5, 5, 0, 5, 5, 0]);
});

test('bats move erratically but legally', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 1000;
  const e = spawn(s, 'bat', 10, 8);
  const cells = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const before = { x: e.x, y: e.y };
    step(s, 'wait');
    assert.ok(Math.abs(e.x - before.x) + Math.abs(e.y - before.y) <= 1);
    assert.notEqual(s.terrain[at(e.x, e.y)], T_WALL);
    cells.add(at(e.x, e.y));
  }
  assert.ok(cells.size > 3);
});

test('monsters do not notice the hero through a closed door, and cannot open it', () => {
  const s = arena();
  for (let y = 1; y < HEIGHT - 1; y++) s.terrain[at(7, y)] = T_WALL;
  s.terrain[at(7, 5)] = T_DOOR;
  const e = spawn(s, 'skeleton', 9, 5);
  for (let i = 0; i < 40; i++) {
    step(s, 'wait');
    assert.ok(e.x > 7);
    assert.equal(e.alert, 0);
  }
});

test('a pursuer gives up after losing sight', () => {
  const s = arena();
  const e = spawn(s, 'skeleton', 9, 5);
  step(s, 'wait');
  assert.equal(e.alert, ALERT_TURNS);
  for (let y = 1; y < HEIGHT - 1; y++) s.terrain[at(7, y)] = T_WALL;
  for (let i = 0; i < ALERT_TURNS; i++) step(s, 'wait');
  assert.equal(e.alert, 0);
});

test('two monsters never share a cell', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 1000;
  for (let i = 0; i < 6; i++) spawn(s, 'skeleton', 9 + i, 5, 99);
  for (let i = 0; i < 20; i++) {
    step(s, 'wait');
    assert.equal(new Set(s.enemies.map((e) => at(e.x, e.y))).size, 6);
  }
});
