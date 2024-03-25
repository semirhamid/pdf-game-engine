// Times row fields against cell fields inside the viewer. Open it and click RUN. The times cover
// the script and appearance rebuild, not the repaint that follows.
import { writeFileSync } from 'node:fs';
import { tileFont, textFont } from '../src/build/fonts.ts';
import { PdfDocument, name, type Dict, type Ref } from '../src/build/pdf.ts';

const doc = new PdfDocument();
const pages = doc.reserve(),
  page = doc.reserve();
const fonts: Dict = { Tile: tileFont(doc), Pixel: textFont(doc) };
const annots: Ref[] = [];
const js = (c: string): Dict => ({ S: name('JavaScript'), JS: c });
const add = (d: Dict): void => {
  annots.push(
    doc.add({
      Type: name('Annot'),
      Subtype: name('Widget'),
      F: 4,
      P: page,
      BS: { W: 0 },
      ...d,
    }),
  );
};
for (let y = 0; y < 15; y++)
  add({
    FT: name('Tx'),
    Ff: 1,
    T: `r${y}`,
    V: '',
    DA: '/Tile 14 Tf 0 g',
    Rect: [10, 270 - y * 14, 290, 284 - y * 14],
  });
for (let y = 0; y < 15; y++)
  for (let x = 0; x < 20; x++) {
    add({
      FT: name('Tx'),
      Ff: 1,
      T: `c${y * 20 + x}`,
      V: '',
      DA: '/Tile 14 Tf 0 g',
      Rect: [310 + x * 14, 270 - y * 14, 324 + x * 14, 284 - y * 14],
    });
  }
for (let i = 0; i < 5; i++)
  add({
    FT: name('Tx'),
    Ff: 1,
    T: `o${i}`,
    V: '',
    DA: '/Pixel 13.5 Tf 0 g',
    Rect: [10, 50 - i * 12, 590, 63.5 - i * 12],
  });
add({
  FT: name('Btn'),
  Ff: 65536,
  T: 'run',
  MK: { BG: [0.9, 0.7, 0.3], CA: 'RUN' },
  DA: '/Pixel 13.5 Tf 0 g',
  Rect: [500, 290, 590, 315],
  AA: { U: js('run()') },
});
const script = `
var doc=this, A="....................", B="####################";
function time(n, f){ var t=new Date().getTime(); for(var i=0;i<n;i++) f(i); return (new Date().getTime()-t)/n; }
function rows(k){ return function(i){ for(var y=0;y<k;y++) doc.getField("r"+y).value=(i%2?A:B); }; }
function cells(k){ return function(i){ for(var c=0;c<k;c++) doc.getField("c"+c).value=(i%2?".":"#"); }; }
function out(i,s){ doc.getField("o"+i).value=s; }
function run(){
  var N=40;
  out(0,"ROWS  FULL 15 WRITES: "+time(N,rows(15)).toFixed(2)+" MS/FRAME");
  out(1,"ROWS  DIRTY 4 WRITES: "+time(N*4,rows(4)).toFixed(2)+" MS/FRAME");
  out(2,"CELLS FULL 300 WRITES: "+time(N,cells(300)).toFixed(2)+" MS/FRAME");
  out(3,"CELLS DIRTY 12 WRITES: "+time(N*4,cells(12)).toFixed(2)+" MS/FRAME");
  out(4,"DONE");
}`;
const content = doc.stream(
  '1 g 0 0 600 320 re f BT 3 Tr /Tile 8 Tf 2 2 Td ( ) Tj /Pixel 8 Tf ( ) Tj ET',
);
doc.set(page, {
  Type: name('Page'),
  Parent: pages,
  MediaBox: [0, 0, 600, 320],
  Contents: content,
  Resources: { Font: fonts },
  Annots: annots,
});
doc.set(pages, { Type: name('Pages'), Count: 1, Kids: [page] });
const root = doc.add({
  Type: name('Catalog'),
  Pages: pages,
  AcroForm: { Fields: annots, DR: { Font: fonts }, DA: '/Pixel 9 Tf 0 g' },
  Names: { JavaScript: { Names: ['main', js(script)] } },
});
writeFileSync(
  new URL('./bench.pdf', import.meta.url),
  doc.build(root, doc.add({ Title: 'PDF DUNGEON render benchmark' })),
);
console.log('wrote poc/bench.pdf');
