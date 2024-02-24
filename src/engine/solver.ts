import { at, DIRECTIONS, T_FLOOR, T_LOCKED, T_WALL, WIDTH, type Level } from './types.ts';

// Flood from the start, pick up keys, open a lock, repeat. Monsters don't matter here because
// all of them can be killed.
export function isSolvable(level: Level): boolean {
  const terrain = level.terrain.slice();
  const taken: boolean[] = [];
  let keys = 0;

  for (;;) {
    const seen: boolean[] = [];
    const locks: number[] = [];
    const queue = [at(level.start.x, level.start.y)];
    seen[queue[0]!] = true;
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i]! % WIDTH;
      const y = Math.floor(queue[i]! / WIDTH);
      for (const dir of DIRECTIONS) {
        const cell = at(x + dir.x, y + dir.y);
        if (seen[cell] || terrain[cell] === T_WALL) continue;
        seen[cell] = true;
        (terrain[cell] === T_LOCKED ? locks : queue).push(cell);
      }
    }
    if (seen[at(level.goal.x, level.goal.y)]) return true;

    level.items.forEach((item, i) => {
      if (item.kind === 'key' && !taken[i] && seen[at(item.x, item.y)]) {
        taken[i] = true;
        keys++;
      }
    });
    if (!keys || !locks.length) return false;
    keys--;
    terrain[locks[0]!] = T_FLOOR;
  }
}
