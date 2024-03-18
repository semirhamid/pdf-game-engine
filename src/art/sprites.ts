import { SPRITE_COLORS } from './palette.ts';

// 16x16 pixels, top row first, null is transparent.
export type Grid = (number | null)[][];

function parse(rows: string[], mirror: boolean): Grid {
  if (rows.length !== 16)
    throw new Error(`Sprite must have 16 rows, got ${rows.length}: ${rows.join('|')}`);
  return rows.map((row) => {
    const full = mirror ? row + row.split('').reverse().join('') : row;
    if (full.length !== 16) throw new Error(`Sprite row must be 16 wide: "${row}"`);
    return full.split('').map((c) => {
      if (c === '.') return null;
      const v = SPRITE_COLORS[c];
      if (v === undefined) throw new Error(`Unknown sprite colour "${c}"`);
      return v;
    });
  });
}
// Left eight columns, mirrored.
const half = (s: string): Grid => parse(s.trim().split(/\s+/), true);
const full = (s: string): Grid => parse(s.trim().split(/\s+/), false);

export const SPRITES: Record<string, Grid> = {
  hero: half(`
    ........
    .....kkk
    ....kbbb
    ...kbbbb
    ...kbBBB
    ...kBsss
    ...kBsks
    ...kBsss
    ....kBss
    ..kkbbyy
    .kbbbbby
    .kbkbbbb
    .kskByyy
    ..kkbBbb
    ...kBBkB
    ...kkkkk`),
  slime: half(`
    ........
    ........
    ........
    ........
    ......kk
    ....kkll
    ...kllll
    ..kllwll
    ..klllll
    .klllkkl
    .kllkwkl
    .klllkkl
    .kLlllll
    .kLLllkk
    ..kLLLLL
    ...kkkkk`),
  bat: half(`
    ........
    ........
    k.......
    kk....k.
    kPk..kpk
    kPPkkppp
    kPpPkppp
    kPpppprp
    .kPppppp
    .kPPpppp
    ..kPkppw
    ..kk.kpk
    ......kp
    .......k
    ........
    ........`),
  skeleton: half(`
    .....kkk
    ....kwww
    ...kwwww
    ...kwkkw
    ...kwkrw
    ...kwwww
    ....kwkw
    .....kkk
    ..kkkwww
    .kwkgkkw
    .kwk.kww
    .kwk.kkw
    ..kwkkww
    ...kkwkk
    ...kwwk.
    ...kkkk.`),
  warden: half(`
    .kk.....
    kykk....
    kYykkkkk
    .kYkGGGG
    ..kGgggg
    ..kGkkkg
    ..kGkrrk
    ..kGkkkG
    .kkkGGkG
    krRkkGGG
    kRRRkkyy
    kRGRRRyY
    .kgkRRRR
    .kgkRRkR
    .kkkGGkk
    ..kkkkk.`),
  crown: half(`
    ........
    ........
    ........
    .k.....k
    kyk...ky
    kyyk.kyo
    kyYyykyy
    kyYyyyyy
    kyyYyyyy
    kyyyYyyr
    kyyyyyrr
    kYyyyyyr
    kYYYYYYY
    .kkkkkkk
    ........
    ........`),
  coin: half(`
    ........
    ........
    ........
    .....kkk
    ....kyyy
    ...kyYYY
    ...kyYyy
    ..kyyYyw
    ..kyyYyw
    ...kyYyy
    ...kyYYY
    ....kyyy
    .....kkk
    ........
    ........
    ........`),
  gem: half(`
    ........
    ........
    ........
    ...kkkkk
    ..kwrrrr
    .kwrrrrr
    kRRRRRRR
    .kRrrrrr
    .kRRrrrr
    ..kRRrrr
    ...kRRrr
    ....kRrr
    .....kRr
    ......kR
    .......k
    ........`),
  potion: half(`
    ........
    ........
    .....kkk
    .....knn
    ......kc
    ......kc
    .....kcc
    ....kcww
    ...kcwrr
    ..kcwrrr
    ..kcrrrr
    ..kcrrrr
    ..kcRrrr
    ...kcRRR
    ....kkkk
    ........`),
  shield: half(`
    ........
    ........
    ..kkkkkk
    ..kggggg
    ..kgbbbb
    ..kgbbby
    ..kgbbyy
    ..kgbyyy
    ..kgbbyy
    ..kGBBby
    ...kGBBb
    ...kGBBB
    ....kGBB
    .....kGG
    ......kk
    ........`),
  key: full(`
    ................
    ................
    ....kkkk........
    ...kyyyyk.......
    ..kyYkkyyk......
    ..kyk..kyk......
    ..kyk..kyk......
    ..kyykkyyk......
    ...kyyyyk.......
    ....kkyyyk......
    ......kyyyk.....
    .......kyyykk...
    ........kyyyyk..
    ........kykYyk..
    .........k.kYk..
    ............k...`),
  sword: full(`
    ................
    .............kk.
    ............kwwk
    ...........kwwgk
    ..........kwwgk.
    .........kwwgk..
    ........kwwgk...
    .......kwwgk....
    ..kk..kwwgk.....
    ..kykkwwgk......
    ...kyywgk.......
    ....kyyk........
    ...knkyyk.......
    ..knk.kyk.......
    .kyk...k........
    ..k.............`),
  heart: half(`
    ........
    ........
    ...kkk..
    ..krrrk.
    .krwrrrk
    .krwrrrr
    .krrrrrr
    .krrrrrr
    ..krrrrr
    ...krrrr
    ....krrr
    .....krr
    ......kr
    .......k
    ........
    ........`),
};

const map = (g: Grid, f: (c: number | null, x: number, y: number) => number | null): Grid =>
  g.map((row, y) => row.map((c, x) => f(c, x, y)));

const heart = SPRITES['heart']!;
const EMPTY_HEART = 0x2a2238;
const outline = SPRITE_COLORS['k']!;
SPRITES['heartEmpty'] = map(heart, (c) => (c === null || c === outline ? c : EMPTY_HEART));
SPRITES['heartHalf'] = map(heart, (c, x) =>
  c === null || c === outline || x < 8 ? c : EMPTY_HEART,
);

// The shape in one solid colour, shown for a moment when something is hit.
export function silhouette(g: Grid, color: number): Grid {
  return map(g, (c) => (c === null ? null : c === outline ? outline : color));
}
