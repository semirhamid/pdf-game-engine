import { textRects, textWidth } from '../art/pixelfont.ts';
import { PALETTE, rgb } from '../art/palette.ts';
import { SPRITES } from '../art/sprites.ts';
import { TERRAIN } from '../art/terrain.ts';
import { gridToOps } from './fonts.ts';
import type { Box } from './layout.ts';
import { formatNumber as num } from './pdf.ts';

// Helpers that return PDF drawing operators as text. Colours are 0xRRGGBB.

export function color(name: string): number {
  const value = PALETTE[name];
  if (value === undefined) throw new Error(`Unknown colour ${name}`);
  return value;
}

export function fill(hex: number, box: Box): string {
  return `${rgb(hex)} rg ${num(box.x)} ${num(box.y)} ${num(box.w)} ${num(box.h)} re f\n`;
}

export function text(hex: number, s: string, x: number, y: number, pixel: number): string {
  return `${rgb(hex)} rg ${textRects(s, x, y, pixel)}`;
}

export function centered(hex: number, s: string, cx: number, y: number, pixel: number): string {
  return text(hex, s, cx - textWidth(s, pixel) / 2, y, pixel);
}

export function sprite(name: string, x: number, y: number, size: number): string {
  const grid = SPRITES[name] ?? TERRAIN[name];
  if (!grid) throw new Error(`Unknown sprite ${name}`);
  const scale = num(size / 16);
  return `q ${scale} 0 0 ${scale} ${num(x)} ${num(y)} cm\n${gridToOps(grid)}Q\n`;
}
