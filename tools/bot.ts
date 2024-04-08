// A bot that can see the whole map. Used for balancing and for recording full runs.
import { newGame, step } from '../src/engine/game.ts';
import {
  at,
  inBounds,
  T_LOCKED,
  T_STAIRS,
  T_WALL,
  WIDTH,
  type Action,
  type GameState,
} from '../src/engine/types.ts';

const MOVES: { action: Action; dx: number; dy: number }[] = [
  { action: 'up', dx: 0, dy: -1 },
  { action: 'right', dx: 1, dy: 0 },
  { action: 'down', dx: 0, dy: 1 },
  { action: 'left', dx: -1, dy: 0 },
];

const CODE: Record<Action, string> = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
  wait: '.',
  potion: 'q',
};

function goalCell(state: GameState): number {
  const stairs = state.terrain.indexOf(T_STAIRS);
  if (stairs >= 0) return stairs;
  const crown = state.items.find((item) => item.kind === 'crown')!;
  return at(crown.x, crown.y);
}

interface RouteOptions {
  avoid?: number;
  useKeys?: boolean;
}

// First step towards the nearest target.
function route(
  state: GameState,
  isTarget: (cell: number) => boolean,
  { avoid = -1, useKeys = false }: RouteOptions,
): Action | null {
  const canOpen = useKeys && state.player.keys > 0;
  const start = at(state.player.x, state.player.y);
  const firstStep = new Map<number, Action | null>([[start, null]]);
  const queue = [start];

  for (const cell of queue) {
    if (cell !== start && isTarget(cell)) return firstStep.get(cell)!;
    for (const { action, dx, dy } of MOVES) {
      const x = (cell % WIDTH) + dx;
      const y = Math.floor(cell / WIDTH) + dy;
      if (!inBounds(x, y)) continue;
      const next = at(x, y);
      const tile = state.terrain[next];
      if (firstStep.has(next) || next === avoid || tile === T_WALL) continue;
      if (tile === T_LOCKED && !canOpen) continue;
      firstStep.set(next, firstStep.get(cell) ?? action);
      queue.push(next);
    }
  }
  return null;
}

// Heal, fight what's adjacent, grab everything, then leave. Keys are spent only once nothing
// else is in reach.
export function decide(state: GameState): Action {
  const { player, enemies, items } = state;
  if (player.hp <= 5 && player.potions) return 'potion';

  for (const enemy of enemies) {
    const move = MOVES.find((m) => player.x + m.dx === enemy.x && player.y + m.dy === enemy.y);
    if (move) return move.action;
  }

  const goal = goalCell(state);
  const isLoot = (cell: number) =>
    cell !== goal && items.some((item) => at(item.x, item.y) === cell);
  return (
    route(state, isLoot, { avoid: goal }) ??
    route(state, isLoot, { avoid: goal, useKeys: true }) ??
    route(state, (cell) => cell === goal, { useKeys: true }) ??
    'wait'
  );
}

export function play(seed: number, limit = 3000): { state: GameState; inputs: string } {
  const state = newGame(seed);
  let inputs = '';
  while (state.status === 'playing' && inputs.length < limit) {
    const a = decide(state);
    inputs += CODE[a];
    step(state, a);
  }
  return { state, inputs };
}

if (process.argv[1]?.endsWith('bot.ts')) {
  const n = Number(process.argv[2] ?? 500);
  const tally = { won: 0, dead: 0, playing: 0 };
  const deaths = [0, 0, 0, 0, 0, 0];
  let turns = 0,
    shortest = { seed: 0, len: 1e9 },
    shortestDeath = { seed: 0, len: 1e9 };
  for (let seed = 1; seed <= n; seed++) {
    const { state, inputs } = play(seed);
    tally[state.status]++;
    turns += state.turn;
    if (state.status === 'dead') {
      deaths[state.floor]!++;
      if (inputs.length < shortestDeath.len) shortestDeath = { seed, len: inputs.length };
    }
    if (state.status === 'won' && inputs.length < shortest.len)
      shortest = { seed, len: inputs.length };
  }
  console.log({
    ...tally,
    averageTurns: Math.round(turns / n),
    deathsByFloor: deaths.slice(1),
    shortest,
    shortestDeath,
  });
}
