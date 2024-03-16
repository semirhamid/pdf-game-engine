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

test('every item has its effect', () => {
  const pick = (kind: ItemKind): GameState => {
    const s = arena();
    put(s, kind, 6, 5);
    step(s, 'right');
    assert.equal(s.items.length, 0);
    return s;
  };
  assert.equal(pick('key').player.keys, 1);
  assert.equal(pick('potion').player.potions, 1);
  assert.equal(pick('sword').player.attack, 3);
  assert.equal(pick('shield').player.defence, 1);
  assert.equal(pick('coin').score, 10);
  assert.equal(pick('gem').score, 50);
});

test('potions heal, are consumed, never overheal, and are not wasted at full health', () => {
  const s = arena();
  s.player.potions = 2;
  step(s, 'potion');
  assert.deepEqual([s.player.potions, s.turn], [2, 0]);
  s.player.hp = 1;
  step(s, 'potion');
  assert.deepEqual([s.player.hp, s.player.potions, s.turn], [1 + POTION_HEAL, 1, 1]);
  s.player.hp = START_HP - 1;
  step(s, 'potion');
  assert.deepEqual([s.player.hp, s.player.potions], [START_HP, 0]);
});

test('attacking damages and kills, and a kill scores', () => {
  const s = arena();
  const e = spawn(s, 'bat', 6, 5);
  s.player.attack = 1;
  step(s, 'right');
  assert.equal(s.player.x, 5, 'attacking does not move');
  assert.ok(e.hp < 2);
  s.player.attack = 9;
  for (let i = 0; i < 20 && s.enemies.length; i++) {
    s.player.x = e.x - 1;
    s.player.y = e.y;
    s.terrain[at(s.player.x, s.player.y)] = 1;
    step(s, 'right');
  }
  assert.deepEqual([s.enemies.length, s.kills, s.score], [0, 1, 15]);
});

test('defence reduces damage to a minimum of one', () => {
  const hit = (def: number): number => {
    const s = arena();
    spawn(s, 'skeleton', 6, 5, 5);
    s.player.defence = def;
    step(s, 'wait');
    return START_HP - s.player.hp;
  };
  assert.deepEqual([hit(0), hit(1), hit(50)], [3, 2, 1]);
});

test('death: health clamps at zero and the run freezes', () => {
  const s = arena();
  spawn(s, 'skeleton', 6, 5, 5);
  s.player.hp = 1;
  step(s, 'wait');
  assert.deepEqual([s.player.hp, s.status], [0, 'dead']);
  assert.ok(types(s).includes('death'));
  const frozen = JSON.stringify({ ...s, events: [] });
  step(s, 'left');
  assert.equal(JSON.stringify({ ...s, events: [] }), frozen);
});

test('stairs lead down, heal a little, and reset keys', () => {
  const s = arena();
  s.terrain[at(6, 5)] = T_STAIRS;
  s.player.hp = 4;
  s.player.keys = 1;
  step(s, 'right');
  assert.deepEqual(
    [s.floor, s.player.hp, s.player.keys, s.score],
    [2, 4 + DESCEND_HEAL, 0, 100],
  );
  assert.ok(s.explored.some(Boolean) && !s.explored.every(Boolean));
});

test('taking the crown wins and converts health into score', () => {
  const s = arena();
  s.floor = FLOORS;
  put(s, 'crown', 6, 5);
  step(s, 'right');
  assert.deepEqual([s.status, s.score], ['won', 500 + START_HP * 10]);
});

test('fog of war: walls hide what is behind them, memory persists', () => {
  const s = arena();
  for (let y = 0; y < HEIGHT; y++) s.terrain[at(8, y)] = T_WALL;
  s.explored.fill(false);
  step(s, 'wait');
  assert.equal(s.visible[at(7, 5)], true);
  assert.equal(s.visible[at(8, 5)], true, 'the wall face itself is seen');
  assert.equal(s.visible[at(10, 5)], false);
  s.player.x = 1;
  s.player.y = 13;
  step(s, 'wait');
  assert.equal(s.visible[at(7, 5)], false);
  assert.equal(s.explored[at(7, 5)], true);
});
