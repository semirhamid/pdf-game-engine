export const PALETTE: Record<string, number> = {
  ink: 0x0c0a14, // page background, unexplored
  panel: 0x15121f,
  line: 0x342c4a,
  text: 0xe8e0d0,
  muted: 0x8d82a6,
  gold: 0xf2b84b,
  ember: 0xe8673c,
  blood: 0xd8394f,
  moss: 0x6cbf5c,
  sky: 0x62b8d8,
};

// Letters used in sprites.ts. A dot is transparent.
export const SPRITE_COLORS: Record<string, number> = {
  k: 0x120e1c, // outline
  w: 0xf4eedf, // bone
  g: 0xa9a3b8, // steel
  G: 0x6b6480, // dark steel
  y: 0xf2b84b, // gold
  Y: 0xb5772a, // dark gold
  r: 0xd8394f, // blood
  R: 0x8a2140, // dark blood
  o: 0xe8673c, // ember
  s: 0xf0c49a, // skin
  b: 0x4a78c8, // cloak
  B: 0x2c4684, // dark cloak
  l: 0x6cbf5c, // slime
  L: 0x3b7d48, // dark slime
  p: 0x9a62c8, // bat
  P: 0x5d3889, // dark bat
  c: 0x62b8d8, // glass
  n: 0x8a5a34, // wood
  N: 0x5b3822, // dark wood
};

export function rgb(hex: number): string {
  const f = (v: number): string => String(Math.round((v / 255) * 1000) / 1000);
  return `${f((hex >> 16) & 255)} ${f((hex >> 8) & 255)} ${f(hex & 255)}`;
}

export function scale(hex: number, k: number): number {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

// Terrain the player remembers but can't see right now: darker and bluer.
export function dim(hex: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const grey = r * 0.3 + g * 0.59 + b * 0.11;
  const mix = (v: number, k: number): number => Math.round((grey * 0.6 + v * 0.4) * k);
  return (mix(r, 0.48) << 16) | (mix(g, 0.48) << 8) | Math.min(255, mix(b, 0.64));
}
