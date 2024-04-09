// A strict reader for our own PDFs. Shares no code with the writer, so it can catch its mistakes.
import { inflateSync } from 'node:zlib';

export interface PdfObject {
  text: string;
  stream: Buffer | null;
}

export function readPdf(bytes: Buffer): { objects: Map<number, PdfObject>; trailer: string } {
  const s = bytes.toString('latin1');
  if (!s.startsWith('%PDF-1.7\n')) throw new Error('bad header');
  if (!s.endsWith('%%EOF\n')) throw new Error('bad tail');
  const start = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)?.[1]);
  if (!s.startsWith('xref\n', start)) throw new Error('startxref does not point at xref');
  const head = /^xref\n0 (\d+)\n/.exec(s.slice(start))!;
  const count = Number(head[1]);
  const table = start + head[0].length;
  const objects = new Map<number, PdfObject>();
  for (let i = 1; i < count; i++) {
    const entry = s.slice(table + i * 20, table + i * 20 + 20);
    const m = /^(\d{10}) 00000 n \n$/.exec(entry);
    if (!m) throw new Error(`bad xref entry ${i}: ${JSON.stringify(entry)}`);
    const at = Number(m[1]);
    const prefix = `${i} 0 obj\n`;
    if (!s.startsWith(prefix, at))
      throw new Error(`xref entry ${i} points at the wrong offset`);
    const body = at + prefix.length;
    const nl = s.indexOf('\nstream\n', body);
    const end = s.indexOf('\nendobj\n', body);
    if (nl >= 0 && nl < end) {
      const text = s.slice(body, nl);
      const len = Number(/\/Length (\d+)/.exec(text)?.[1]);
      const from = nl + '\nstream\n'.length;
      if (!s.startsWith('\nendstream\nendobj\n', from + len))
        throw new Error(`bad /Length in object ${i}`);
      const raw = bytes.subarray(from, from + len);
      objects.set(i, {
        text,
        stream: text.includes('/FlateDecode') ? inflateSync(raw) : Buffer.from(raw),
      });
    } else {
      objects.set(i, { text: s.slice(body, end), stream: null });
    }
  }
  const trailer = s.slice(s.indexOf('trailer\n', start), s.lastIndexOf('startxref'));
  for (const [n, o] of objects) {
    for (const m of o.text.matchAll(/(\d+) 0 R/g))
      if (!objects.has(Number(m[1])))
        throw new Error(`object ${n} has a dangling reference ${m[0]}`);
  }
  return { objects, trailer };
}

export interface Field {
  name: string;
  type: string;
  text: string;
  rect: number[];
  flags: number;
  annotFlags: number;
  order: number;
}

export function readFields(objects: Map<number, PdfObject>): Map<string, Field> {
  const page = [...objects.values()].find((o) => /\/Type \/Page /.test(o.text))!;
  const order = /\/Annots \[([^\]]*)\]/
    .exec(page.text)![1]!
    .match(/\d+(?= 0 R)/g)!
    .map(Number);
  const fields = new Map<string, Field>();
  order.forEach((num, i) => {
    const { text } = objects.get(num)!;
    const name = /\/T \(([^)]*)\)/.exec(text)![1]!;
    if (fields.has(name)) throw new Error(`duplicate field ${name}`);
    fields.set(name, {
      name,
      text,
      order: i,
      type: /\/FT \/(\w+)/.exec(text)![1]!,
      rect: /\/Rect \[([^\]]*)\]/.exec(text)![1]!.split(' ').map(Number),
      flags: Number(/\/Ff (\d+)/.exec(text)?.[1] ?? 0),
      annotFlags: Number(/ \/F (\d+)/.exec(text)?.[1] ?? 0),
    });
  });
  return fields;
}
