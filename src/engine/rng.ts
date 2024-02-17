export interface Rng {
  s: number;
}

// xorshift32. It only needs bitwise operators, so old engines without Math.imul agree on it.
export function next(rng: Rng): number {
  let s = rng.s;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  rng.s = s | 0;
  return s >>> 0;
}

export function makeRng(seed: number): Rng {
  const rng = { s: seed | 0 || 0x6d2b79f5 }; // xorshift is stuck at zero forever
  for (let i = 0; i < 8; i++) next(rng); // small seeds start out too similar
  return rng;
}

export function int(rng: Rng, max: number): number {
  return max > 0 ? next(rng) % max : 0;
}

export function chance(rng: Rng, percent: number): boolean {
  return int(rng, 100) < percent;
}
