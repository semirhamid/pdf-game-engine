// Records the bot playing in Chrome. Needs ffmpeg. Usage: node tools/record.ts [seed]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE } from '../src/build/layout.ts';
import { play } from './bot.ts';
import { sleep } from './chrome.ts';
import { Player } from './player.ts';

const seed = Number(process.argv[2] ?? 292);
const out = fileURLToPath(new URL('../docs/media/', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'pdf-dungeon-rec-'));
const p = await Player.open(fileURLToPath(new URL('../dist/game.pdf', import.meta.url)), {
  width: 1280,
  height: 720,
});
let n = 0;
const frame = async (hold = 1): Promise<void> => {
  const { png } = await p.chrome.screenshot();
  for (let i = 0; i < hold; i++)
    writeFileSync(join(tmp, `f${String(n++).padStart(5, '0')}.png`), png);
};
await frame(12);
await p.start(seed);
await frame(6);
for (const c of play(seed).inputs) {
  await p.key(c);
  await sleep(45);
  await frame();
  await sleep(140); // let the hit flash clear
}
await sleep(300);
await frame(24);
const [x, y] = p.at(0, PAGE.h);
const [x2, y2] = p.at(PAGE.w, 0);
const even = (v: number): number => Math.floor(v / 2) * 2;
const crop = `crop=${even(x2 - x)}:${even(y2 - y)}:${Math.round(x)}:${Math.round(y)}`;
const ff = (args: string[]): void => {
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-framerate',
    '8',
    '-i',
    join(tmp, 'f%05d.png'),
    ...args,
  ]);
};
ff([
  '-vf',
  crop,
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '20',
  '-movflags',
  '+faststart',
  join(out, 'demo.mp4'),
]);
ff([
  '-frames:v',
  '130',
  '-vf',
  `${crop},scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none`,
  join(out, 'demo.gif'),
]);
await p.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`recorded ${n} frames from ${p.chrome.version}`);
