// The first experiment: which PDF features actually work in a viewer? Each result shows on the page.
import { writeFileSync } from 'node:fs';
import { PdfDocument, name, type Dict, type Ref } from '../src/build/pdf.ts';

const doc = new PdfDocument();
const pagesRef = doc.reserve();
const pageRef = doc.reserve();
const W = 640,
  H = 440,
  COLS = 10,
  ROWS = 8,
  T = 26,
  GX = 20,
  GY = 150;

// tiles as a colour font
const glyphs: Record<string, [code: number, program: string]> = {
  period: [46, '0.16 0.16 0.22 rg 0 0 16 16 re f 0.22 0.22 0.30 rg 1 1 14 14 re f'],
  numbersign: [
    35,
    '0.30 0.24 0.42 rg 0 0 16 16 re f 0.48 0.40 0.62 rg 0 9 7 6 re f 8 9 8 6 re f 0 1 3 6 re f 4 1 8 6 re f 13 1 3 6 re f',
  ],
  at: [
    64,
    '0.95 0.78 0.30 rg 4 2 8 8 re f 0.98 0.85 0.65 rg 5 9 6 5 re f 0.1 0.1 0.1 rg 6 11 1 1 re f 9 11 1 1 re f',
  ],
};
const charProcs: Dict = {};
const differences: (number | ReturnType<typeof name>)[] = [];
for (const [g, [code, prog]] of Object.entries(glyphs)) {
  charProcs[g] = doc.stream(`16 0 d0\n${prog}\n`);
  differences.push(code, name(g));
}
const first = 32,
  last = 126;
// Without this PDFium can't find Type 3 glyphs and uses Helvetica instead.
const toUnicode = doc.stream(`/CIDInit /ProcSet findresource begin 12 dict begin begincmap
/CMapName /Tile def /CMapType 2 def
1 begincodespacerange <00> <FF> endcodespacerange
1 beginbfrange <20> <7E> <0020> endbfrange
endcmap CMapName currentdict /CMap defineresource pop end end`);
const tileFont = doc.add({
  Type: name('Font'),
  Subtype: name('Type3'),
  Name: name('Tile'),
  FontBBox: [0, 0, 16, 16],
  FontMatrix: [1 / 16, 0, 0, 1 / 16, 0, 0],
  ToUnicode: toUnicode,
  CharProcs: charProcs,
  Resources: {},
  Encoding: { Type: name('Encoding'), Differences: differences },
  FirstChar: first,
  LastChar: last,
  Widths: Array.from({ length: last - first + 1 }, () => 16),
});
const helv = doc.add({
  Type: name('Font'),
  Subtype: name('Type1'),
  BaseFont: name('Helvetica'),
  Encoding: name('WinAnsiEncoding'),
});

const annots: Ref[] = [];
const js = (code: string): Dict => ({ S: name('JavaScript'), JS: code });
function widget(t: string, x: number, y: number, w: number, h: number, extra: Dict): void {
  annots.push(
    doc.add({
      Type: name('Annot'),
      Subtype: name('Widget'),
      T: t,
      F: 4,
      P: pageRef,
      Rect: [x, y, x + w, y + h],
      ...extra,
    }),
  );
}
const text = (t: string, x: number, y: number, w: number, h: number, extra: Dict = {}): void =>
  widget(t, x, y, w, h, { FT: name('Tx'), DA: '/Helv 9 Tf 0 g', V: '', Ff: 1, ...extra });
function button(
  t: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  aa: Dict,
): void {
  const ap = doc.stream(
    `0.2 0.2 0.3 rg 0 0 ${w} ${h} re f BT /Helv 12 Tf 1 g ${w / 2 - label.length * 3} ${h / 2 - 4} Td (${label}) Tj ET`,
    {
      Type: name('XObject'),
      Subtype: name('Form'),
      BBox: [0, 0, w, h],
      Resources: { Font: { Helv: helv } },
    },
  );
  widget(t, x, y, w, h, {
    FT: name('Btn'),
    Ff: 65536,
    AP: { N: ap },
    MK: { BG: [0.2, 0.2, 0.3], CA: label },
    DA: '/Helv 12 Tf 1 g',
    AA: aa,
  });
}

for (let r = 0; r < ROWS; r++) {
  text(`row${r}`, GX, GY + (ROWS - 1 - r) * T, COLS * T, T, { DA: `/Tile ${T} Tf 0 g` });
}
// fillColor, display and rect
text('fill', 320, 330, 60, 24, { MK: { BG: [0.8, 0.8, 0.8] } });
const art = doc.stream('0.9 0.2 0.2 rg 12 0 m 24 12 l 12 24 l 0 12 l f', {
  Type: name('XObject'),
  Subtype: name('Form'),
  BBox: [0, 0, 24, 24],
});
widget('disp', 400, 330, 24, 24, { FT: name('Btn'), Ff: 65536, AP: { N: art } });
text('rectf', 440, 330, 24, 24, { MK: { BG: [0.2, 0.7, 0.3] } });

const LOG = 10;
for (let i = 0; i < LOG; i++) text(`log${i}`, 320, 150 + (LOG - 1 - i) * 15, 300, 14);

button('up', 70, 90, 40, 36, 'UP', { U: js('act(0,-1,"mouse-up")') });
button('down', 70, 20, 40, 36, 'DN', { U: js('act(0,1,"mouse-up")') });
button('left', 25, 55, 40, 36, 'LT', { U: js('act(-1,0,"mouse-up")') });
button('right', 115, 55, 40, 36, 'RT', { D: js('act(1,0,"mouse-down")') });
widget('keys', 200, 60, 140, 24, {
  FT: name('Tx'),
  DA: '/Helv 11 Tf 0 g',
  V: '',
  MK: { BG: [1, 1, 0.85], BC: [0.4, 0.4, 0.4] },
  AA: {
    K: js('onKey()'),
    Fo: js('log("focus keys")'),
    Bl: js('log("blur keys")'),
    E: js('log("mouse enter keys")'),
  },
});

const script = `
var COLS=${COLS}, ROWS=${ROWS}, px=2, py=2, lines=[], doc=this, n=0, rows=[];
function cell(x,y){ return (x==0||y==0||x==COLS-1||y==ROWS-1||(x==5&&y!=4))?"#":"."; }
function log(s){ lines.push((++n)+": "+s); while(lines.length>${LOG}) lines.shift();
  for(var i=0;i<${LOG};i++){ var v=lines[i]||""; var f=doc.getField("log"+i); if(f.value!=v) f.value=v; } }
function draw(){ for(var y=0;y<ROWS;y++){ var s=""; for(var x=0;x<COLS;x++) s+=(x==px&&y==py)?"@":cell(x,y);
  if(rows[y]!==s){ rows[y]=s; doc.getField("row"+y).value=s; } } }
function act(dx,dy,src){ var ok=cell(px+dx,py+dy)!="#"; if(ok){px+=dx;py+=dy;draw();}
  log(src+" "+dx+","+dy+(ok?"":" blocked")+" @"+px+","+py);
  try{ doc.getField("keys").setFocus(); }catch(e){ log("setFocus threw "+e); } }
function onKey(){ var c=event.change, m={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]};
  if(event.willCommit){ log("commit"); return; }
  event.rc=false;
  if(m[c]) act(m[c][0],m[c][1],"key "+c); else log("key code "+(c&&c.length?c.charCodeAt(0):"none")+" keyDown="+event.keyDown); }
draw();
log("viewer "+app.viewerType+" v"+app.viewerVersion+" "+app.platform);
try{ doc.getField("fill").fillColor=["RGB",1,0,0]; log("fillColor did not throw"); }catch(e){ log("fillColor threw "+e); }
try{ doc.getField("disp").display=1; doc.getField("disp").display=0; log("display toggled"); }catch(e){ log("display threw "+e); }
try{ doc.getField("rectf").rect=[440,360,464,384]; log("rect set"); }catch(e){ log("rect threw "+e); }
try{ app.setTimeOut("log('timer fired')",400); }catch(e){ log("timer threw "+e); }
try{ doc.getField("up").buttonSetCaption("X"); log("buttonSetCaption ok"); }catch(e){ log("buttonSetCaption threw"); }
try{ doc.getField("keys").setFocus(); log("setFocus ok"); }catch(e){ log("setFocus threw"); }
`;

const content = doc.stream(`0.08 0.08 0.11 rg 0 0 ${W} ${H} re f 0.9 g 310 140 320 190 re f
BT /Helv 14 Tf 1 g 20 412 Td (PDF DUNGEON - capability probe) Tj ET
BT /Helv 9 Tf 0.8 g 200 90 Td (Click here, then press W A S D:) Tj ET
BT /Helv 8 Tf 0.8 g 320 358 Td (fillColor) Tj 80 0 Td (display) Tj 40 0 Td (rect) Tj ET`);
doc.set(pageRef, {
  Type: name('Page'),
  Parent: pagesRef,
  MediaBox: [0, 0, W, H],
  Contents: content,
  Resources: { Font: { Helv: helv } },
  Annots: annots,
});
doc.set(pagesRef, { Type: name('Pages'), Count: 1, Kids: [pageRef] });
const root = doc.add({
  Type: name('Catalog'),
  Pages: pagesRef,
  AcroForm: {
    Fields: annots,
    DR: { Font: { Helv: helv, Tile: tileFont } },
    DA: '/Helv 9 Tf 0 g',
    NeedAppearances: false,
  },
  Names: { JavaScript: { Names: ['main', { S: name('JavaScript'), JS: script }] } },
});
const info = doc.add({ Title: 'PDF DUNGEON capability probe' });
writeFileSync(new URL('./probe.pdf', import.meta.url), doc.build(root, info));
console.log('wrote poc/probe.pdf');
