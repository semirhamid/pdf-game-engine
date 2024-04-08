import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPdf } from './page.ts';

const out = fileURLToPath(new URL('../../dist/game.pdf', import.meta.url));
mkdirSync(fileURLToPath(new URL('../../dist', import.meta.url)), { recursive: true });
const pdf = buildPdf();
writeFileSync(out, pdf);
console.log(
  `dist/game.pdf  ${pdf.length} bytes  sha256 ${createHash('sha256').update(pdf).digest('hex')}`,
);
