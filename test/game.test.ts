import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newGame, step } from '../src/engine/game.ts';
import { DESCEND_HEAL, POTION_HEAL, START_HP } from '../src/engine/rules.ts';
import {
  at,
  FLOORS,
  HEIGHT,
  T_DOOR,
  T_DOOR_OPEN,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  WIDTH,
  type Action,
  type GameState,
  type ItemKind,
} from '../src/engine/types.ts';
import { arena, spawn } from './support/arena.ts';

const types = (s: GameState): string[] => s.events.map((e) => e.type);
const put = (s: GameState, kind: ItemKind, x: number, y: number): void => {
  s.items.push({ kind, x, y });
};

test('moves one cell in each direction', () => {
  for (const [a, dx, dy] of [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ] as [Action, number, number][]) {
    const s = arena();
    step(s, a);
    assert.deepEqual([s.player.x, s.player.y, s.turn], [5 + dx, 5 + dy, 1]);
  }
});

test('walls block movement and cost no turn', () => {
  const s = arena();
  s.terrain[at(6, 5)] = T_WALL;
  step(s, 'right');
  assert.deepEqual([s.player.x, s.turn, types(s)], [5, 0, ['bump']]);
});

test('the hero can never leave the map or stand in a wall', () => {
  const dirs: Action[] = ['up', 'down', 'left', 'right'];
  for (let seed = 1; seed <= 20; seed++) {
    const s = newGame(seed);
    for (let i = 0; i < 300 && s.status === 'playing'; i++) {
      step(s, dirs[(i * 7 + seed * 3 + ((i / 11) | 0)) % 4]!);
      assert.ok(
        s.player.x > 0 && s.player.y > 0 && s.player.x < WIDTH - 1 && s.player.y < HEIGHT - 1,
      );
      assert.notEqual(s.terrain[at(s.player.x, s.player.y)], T_WALL);
      const cells = s.enemies.map((e) => at(e.x, e.y));
      assert.equal(new Set(cells).size, cells.length, 'monsters overlap');
      if (s.status === 'playing')
        assert.ok(!cells.includes(at(s.player.x, s.player.y)), 'monster on hero');
    }
  }
});

test('a closed door takes one turn to open, then can be walked through', () => {
  const s = arena();
  s.terrain[at(6, 5)] = T_DOOR;
  step(s, 'right');
  assert.deepEqual([s.player.x, s.terrain[at(6, 5)], s.turn], [5, T_DOOR_OPEN, 1]);
  step(s, 'right');
  assert.equal(s.player.x, 6);
});

test('a locked door needs a key and consumes it', () => {
  const s = arena();
  s.terrain[at(6, 5)] = T_LOCKED;
  step(s, 'right');
  assert.deepEqual([s.turn, types(s)], [0, ['locked']]);
  s.player.keys = 1;
  step(s, 'right');
  assert.deepEqual(
    [s.player.keys, s.terrain[at(6, 5)], types(s)],
    [0, T_DOOR_OPEN, ['unlock']],
  );
});
