// Plays game.pdf in Chrome and reads the game state back from screenshots.
import { BITS, BOARD, BUTTONS, PAGE, SEED } from '../src/build/layout.ts';
import { PALETTE } from '../src/art/palette.ts';
import { Chrome, sleep, type Image } from './chrome.ts';

function near(pixels: Buffer, i: number, hex: number): boolean {
  return [hex >> 16, (hex >> 8) & 255, hex & 255].every(
    (channel, k) => Math.abs(pixels[i + k]! - channel) <= 2,
  );
}

export interface Telemetry {
  hash: number;
  turn: number;
}

export class Player {
  readonly chrome: Chrome;
  private left = 0;
  private top = 0;
  private scale = 1;

  private constructor(chrome: Chrome) {
    this.chrome = chrome;
  }

  static async open(
    pdf: string,
    opts: Parameters<typeof Chrome.open>[1] = {},
  ): Promise<Player> {
    const p = new Player(await Chrome.open(pdf, { width: 1280, height: 800, ...opts }));
    await p.calibrate();
    return p;
  }

  // Finds the page by its background colours. The sidebar thumbnail has them too, so only look at
  // rows that are mostly page, and follow the bottom one in from its right end.
  async calibrate(): Promise<void> {
    const shot = await this.chrome.settle();
    const isColor = (x: number, y: number, name: string) =>
      near(shot.data, (y * shot.width + x) * 3, PALETTE[name]!);
    const isPage = (x: number, y: number) => isColor(x, y, 'ink') || isColor(x, y, 'panel');

    const rows: number[] = [];
    for (let y = 0; y < shot.height; y++) {
      let count = 0;
      for (let x = 0; x < shot.width; x++) if (isPage(x, y)) count++;
      if (count >= shot.width * 0.3) rows.push(y);
    }
    if (!rows.length) throw new Error('The page is not on screen');
    const top = rows[0]!;
    const bottom = rows[rows.length - 1]!;

    const row = bottom - 2;
    let right = shot.width - 1;
    while (right > 0 && !isPage(right, row)) right--;
    let left = right;
    while (left > 0 && (isPage(left - 1, row) || isColor(left - 1, row, 'line'))) left--;

    const width = right - left + 1;
    const height = bottom - top + 1;
    if (Math.abs(height / width - PAGE.h / PAGE.w) > 0.02) {
      throw new Error(`Found something ${width}x${height}, which is not the page`);
    }
    this.scale = width / PAGE.w;
    this.left = left;
    this.top = top;
  }

  // PDF points to screen pixels.
  at(x: number, y: number): [number, number] {
    return [this.left + x * this.scale, this.top + (PAGE.h - y) * this.scale];
  }

  async clickAt(x: number, y: number): Promise<void> {
    await this.chrome.click(...this.at(x, y));
  }
  async clickBoard(): Promise<void> {
    await this.clickAt(BOARD.x + BOARD.w * 0.7, BOARD.y + BOARD.h * 0.35);
    await sleep(150);
  }
  async press(id: string): Promise<void> {
    const b = BUTTONS[id]!;
    await this.clickAt(b.x + b.w / 2, b.y + b.h / 2);
    await sleep(60);
  }
  async key(k: string): Promise<void> {
    await this.chrome.key(k);
  }

  async start(seed: number | string): Promise<void> {
    // Click the right end so the caret lands after any old seed.
    await this.clickAt(SEED.x + SEED.w - 4, SEED.y + SEED.h / 2);
    await sleep(150);
    for (let i = 0; i < 16; i++) await this.key('Backspace');
    for (const c of String(seed)) await this.key(c);
    await sleep(100);
    await this.clickBoard();
    await sleep(300);
  }

  decode(im: Image): Telemetry | null {
    let bits = '';
    for (let i = 0; i < BITS.count; i++) {
      const [x, y] = this.at(BITS.x + (i + 0.5) * BITS.cell, BITS.y + BITS.cell / 2);
      const v = im.data[(Math.round(y) * im.width + Math.round(x)) * 3]!;
      bits += v > 127 ? '1' : '0';
    }
    if (!bits.startsWith('1010')) return null;
    return { hash: parseInt(bits.slice(4, 36), 2), turn: parseInt(bits.slice(36), 2) };
  }

  // Keeps reading until it matches or time runs out, then returns the last reading.
  async expect(want: (t: Telemetry) => boolean, timeout = 2500): Promise<Telemetry | null> {
    const end = Date.now() + timeout;
    let last: Telemetry | null = null;
    do {
      last = this.decode(await this.chrome.screenshot());
      if (last && want(last)) return last;
      await sleep(15);
    } while (Date.now() < end);
    return last;
  }

  pixel(im: Image, x: number, y: number): number {
    const [px, py] = this.at(x, y);
    const i = (Math.round(py) * im.width + Math.round(px)) * 3;
    return (im.data[i]! << 16) | (im.data[i + 1]! << 8) | im.data[i + 2]!;
  }

  close(): Promise<void> {
    return this.chrome.close();
  }
}
