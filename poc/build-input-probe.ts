// Which form field makes the best keyboard? Compares a list box with two kinds of text field, and
// checks that starting from the page-open action fixes the clipped first frame.
import { writeFileSync } from 'node:fs';
import { PdfDocument, name, type Dict, type Ref } from '../src/build/pdf.ts';

const doc = new PdfDocument();
const pages = doc.reserve(),
  page = doc.reserve();
const js = (c: string): Dict => ({ S: name('JavaScript'), JS: c });
const helv = doc.add({
  Type: name('Font'),
  Subtype: name('Type1'),
  BaseFont: name('Helvetica'),
  Encoding: name('WinAnsiEncoding'),
});
const cmap = doc.stream(`/CIDInit /ProcSet findresource begin 12 dict begin begincmap
/CMapName /Tile def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange
1 beginbfrange <20> <7E> <0020> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end`);
const tile = doc.add({
  Type: name('Font'),
  Subtype: name('Type3'),
  FontBBox: [0, 0, 16, 16],
  FontMatrix: [1 / 16, 0, 0, 1 / 16, 0, 0],
  ToUnicode: cmap,
  Resources: {},
  CharProcs: {
    numbersign: doc.stream(
      '16 0 d0 0.3 0.25 0.45 rg 0 0 16 16 re f 0.9 0.4 0.3 rg 2 2 12 12 re f',
    ),
  },
  Encoding: { Type: name('Encoding'), Differences: [35, name('numbersign')] },
  FirstChar: 35,
  LastChar: 35,
  Widths: [16],
});
const annots: Ref[] = [];
const add = (d: Dict): void => {
  annots.push(
    doc.add({
      Type: name('Annot'),
      Subtype: name('Widget'),
      F: 4,
      P: page,
      DA: '/Helv 10 Tf 0 g',
      ...d,
    }),
  );
};
add({
  FT: name('Tx'),
  T: 'row',
  Ff: 1,
  V: '',
  Rect: [20, 340, 280, 366],
  DA: '/Tile 26 Tf 0 g',
});
const OPTS = ['L', 'w', 'a', 's', 'd', ' ', '1', '2', '3', '4', 'R'];
add({
  FT: name('Ch'),
  T: 'lb',
  Opt: OPTS,
  V: '2',
  I: [7],
  Rect: [20, 60, 120, 260],
  MK: { BG: [1, 1, 0.9] },
  AA: { K: js('lbKey()'), Fo: js('log("lb focus")'), Bl: js('log("lb blur")') },
});
add({
  FT: name('Tx'),
  T: 'txt_rc',
  V: '',
  Rect: [140, 200, 260, 224],
  MK: { BG: [1, 1, 0.9] },
  AA: { K: js('txtKey("rc")'), Bl: js('log("rc blur")') },
});
add({
  FT: name('Tx'),
  T: 'txt_chg',
  V: '',
  Rect: [140, 140, 260, 164],
  MK: { BG: [1, 1, 0.9] },
  AA: { K: js('txtKey("chg")') },
});
add({
  FT: name('Btn'),
  Ff: 65536,
  T: 'focus',
  Rect: [140, 60, 260, 100],
  MK: { BG: [0.6, 0.7, 1], CA: 'focus listbox' },
  AA: { U: js('log("btn");this.getField("lb").setFocus()') },
});
for (let i = 0; i < 22; i++)
  add({
    FT: name('Tx'),
    T: `log${i}`,
    Ff: 1,
    V: '',
    Rect: [290, 360 - i * 15, 610, 374 - i * 15],
  });

const script = `
var doc=this, lines=[], n=0, OPTS=${JSON.stringify(OPTS)};
function log(s){ lines.push((++n)+": "+s); while(lines.length>22) lines.shift();
  for(var i=0;i<22;i++){ var v=lines[i]||""; var f=doc.getField("log"+i); if(f.value!=v) f.value=v; } }
var MID=7, busy=false;
function lbKey(){ if(event.willCommit||busy) return;
  var c=event.change, i=-1; for(var k=0;k<OPTS.length;k++) if(OPTS[k]===c) i=k;
  // PDFium ignores a reset while the list box is focused.
  busy=true; doc.getField("focus").setFocus(); doc.getField("lb").currentValueIndices=MID; doc.getField("lb").setFocus(); busy=false;
  log("lb "+(i===0?"LEFT":i===OPTS.length-1?"RIGHT":i===MID-1?"UP":i===MID+1?"DOWN":"char["+c+"]")); }
function txtKey(m){ var c=event.change; if(m=="rc") event.rc=false; else event.change="";
  log(m+" ["+(c&&c.length?c.charCodeAt(0):"none")+"] wc="+event.willCommit); }
var started=false;
function boot(){ if(started) return; started=true; doc.getField("row").value="#### ####"; log("page open init"); }
`;
const content = doc.stream(
  '0.1 0.1 0.15 rg 0 0 640 400 re f 0.9 g 285 20 340 360 re f BT 3 Tr /Tile 26 Tf 20 300 Td (#) Tj ET',
);
doc.set(page, {
  Type: name('Page'),
  Parent: pages,
  MediaBox: [0, 0, 640, 400],
  Contents: content,
  Resources: { Font: { Helv: helv, Tile: tile } },
  Annots: annots,
  AA: { O: js('boot()') },
});
doc.set(pages, { Type: name('Pages'), Count: 1, Kids: [page] });
const root = doc.add({
  Type: name('Catalog'),
  Pages: pages,
  AcroForm: { Fields: annots, DR: { Font: { Helv: helv, Tile: tile } }, DA: '/Helv 10 Tf 0 g' },
  Names: { JavaScript: { Names: ['main', js(script)] } },
});
writeFileSync(
  new URL('./input-probe.pdf', import.meta.url),
  doc.build(root, doc.add({ Title: 'PDF DUNGEON input probe' })),
);
console.log('wrote poc/input-probe.pdf');
