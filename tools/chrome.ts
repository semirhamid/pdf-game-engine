// Drives Chrome over the DevTools protocol. A PDF has no DOM, so all it can do is send real input
// and take screenshots.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const CANDIDATES = [
  process.env['CHROME_PATH'],
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export function findChrome(): string | undefined {
  return CANDIDATES.find((p): p is string => !!p && existsSync(p));
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface Image {
  width: number;
  height: number;
  data: Buffer;
  /* RGB */ png: Buffer;
}

// Just enough PNG to read Chrome's screenshots: 8-bit RGB or RGBA, not interlaced.
export function decodePng(png: Buffer): Image {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('Unsupported PNG');
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (!channels) throw new Error('Unsupported PNG colour type');
    } else if (type === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= channels ? px[y * stride + x - channels]! : 0;
      const b = y > 0 ? px[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels]! : 0;
      let p = 0;
      if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (v + p) & 0xff;
    }
  }
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) px.copy(data, i * 3, i * channels, i * channels + 3);
  return { width, height, data, png };
}
