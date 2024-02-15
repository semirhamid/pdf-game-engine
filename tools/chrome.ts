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

export class Chrome {
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private proc!: ChildProcess;
  private ws!: WebSocket;
  private server!: Server;
  private profile!: string;
  private sessionId = '';
  version = '';

  static async open(
    pdfPath: string,
    opts: { width?: number; height?: number; headless?: boolean; scale?: number } = {},
  ): Promise<Chrome> {
    const bin = findChrome();
    if (!bin) throw new Error('Chrome not found (set CHROME_PATH)');
    const c = new Chrome();
    const width = opts.width ?? 1280;
    const height = opts.height ?? 800;

    c.server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/pdf', 'cache-control': 'no-store' });
      res.end(readFileSync(pdfPath));
    });
    await new Promise<void>((r) => c.server.listen(0, '127.0.0.1', r));
    const port = (c.server.address() as { port: number }).port;

    c.profile = mkdtempSync(join(tmpdir(), 'pdf-dungeon-chrome-'));
    c.proc = spawn(
      bin,
      [
        ...((opts.headless ?? !process.env['HEADFUL']) === false ? [] : ['--headless=new']),
        '--remote-debugging-port=0',
        `--user-data-dir=${c.profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        `--window-size=${width},${height}`,
        `--force-device-scale-factor=${opts.scale ?? 1}`,
        ...(process.env['CI'] ? ['--no-sandbox'] : []),
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    const wsUrl = await new Promise<string>((resolve, reject) => {
      let err = '';
      const t = setTimeout(() => reject(new Error('Chrome did not start:\n' + err)), 20000);
      c.proc.stderr!.on('data', (d) => {
        err += d;
        const m = /DevTools listening on (ws:\S+)/.exec(err);
        if (m) {
          clearTimeout(t);
          resolve(m[1]!);
        }
      });
    });
    c.ws = new WebSocket(wsUrl);
    await new Promise((r, j) => {
      c.ws.onopen = r;
      c.ws.onerror = j;
    });
    c.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      const p = msg.id && c.pending.get(msg.id);
      if (!p) return;
      c.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    };
    c.version = (await c.send('Browser.getVersion', {}, true)).product;
    const { targetInfos } = await c.send('Target.getTargets', {}, true);
    const page = targetInfos.find((t: any) => t.type === 'page');
    c.sessionId = (
      await c.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, true)
    ).sessionId;
    await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: opts.scale ?? 1,
      mobile: false,
    });
    await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/game.pdf` });
    await c.settle();
    return c;
  }

  send(method: string, params: object = {}, browser = false): Promise<any> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(browser ? {} : { sessionId: this.sessionId }),
        }),
      );
    });
  }

  async screenshot(): Promise<Image> {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    return decodePng(Buffer.from(data, 'base64'));
  }

  // Waits until two screenshots in a row match.
  async settle(timeout = 10000): Promise<Image> {
    const end = Date.now() + timeout;
    await sleep(1500);
    let prev = await this.screenshot();
    while (Date.now() < end) {
      await sleep(250);
      const next = await this.screenshot();
      if (next.data.equals(prev.data)) return next;
      prev = next;
    }
    return prev;
  }

  async click(x: number, y: number): Promise<void> {
    // Move in first. PDFium sets up a widget's input when the mouse enters it.
    for (const d of [6, 3, 0]) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - d, y });
      await sleep(20);
    }
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await sleep(20);
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  }

  async key(key: string): Promise<void> {
    const special: Record<string, [code: string, vk: number, text?: string]> = {
      ArrowUp: ['ArrowUp', 38],
      ArrowDown: ['ArrowDown', 40],
      ArrowLeft: ['ArrowLeft', 37],
      ArrowRight: ['ArrowRight', 39],
      Enter: ['Enter', 13, '\r'],
      Escape: ['Escape', 27, '\x1b'],
      Tab: ['Tab', 9],
      ' ': ['Space', 32, ' '],
      // Escape and Backspace need their character, like a real keyboard sends. Without it,
      // headless Chrome stalls on the next mouse event. A normal window doesn't.
      Backspace: ['Backspace', 8, '\b'],
    };
    const [code, vk, text] = special[key] ?? [
      /[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : 'Digit' + key,
      key.toUpperCase().charCodeAt(0),
      key,
    ];
    const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
    await this.send('Input.dispatchKeyEvent', {
      type: text ? 'keyDown' : 'rawKeyDown',
      ...base,
      ...(text ? { text, unmodifiedText: text } : {}),
    });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  async close(): Promise<void> {
    // Chrome can drop the socket before it answers, so don't wait for the reply.
    const exited = new Promise<void>((r) => this.proc.once('exit', () => r()));
    this.send('Browser.close', {}, true).catch(() => undefined);
    await Promise.race([exited, sleep(3000)]);
    this.proc.kill('SIGKILL');
    this.ws.close();
    this.server.closeAllConnections();
    this.server.close();
    await sleep(200);
    rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
