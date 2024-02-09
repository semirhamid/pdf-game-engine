import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export class Name {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
}
export class Ref {
  readonly num: number;
  constructor(num: number) {
    this.num = num;
  }
}
// PDF syntax to be written as is.
export class Raw {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}

export type Dict = { [key: string]: PdfValue | undefined };
export type PdfValue = Name | Ref | Raw | string | number | boolean | null | PdfValue[] | Dict;

export const name = (n: string): Name => new Name(n);

type Body = { kind: 'value'; value: PdfValue } | { kind: 'stream'; dict: Dict; data: Buffer };

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Non-finite number in PDF: ${n}`);
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

function escapeName(n: string): string {
  let out = '/';
  for (const ch of Buffer.from(n, 'utf8')) {
    const regular = ch > 0x20 && ch < 0x7f && !'()<>[]{}/%#'.includes(String.fromCharCode(ch));
    out += regular ? String.fromCharCode(ch) : '#' + ch.toString(16).padStart(2, '0');
  }
  return out;
}

// ASCII is written literally, anything else as UTF-16BE hex.
export function formatString(s: string): string {
  if (/^[\x00-\x7f]*$/.test(s)) {
    const body = s
      .replace(/[\\()]/g, (c) => '\\' + c)
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    return `(${body})`;
  }
  let hex = 'feff';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

export function serialize(v: PdfValue): string {
  if (v === null) return 'null';
  if (v instanceof Name) return escapeName(v.name);
  if (v instanceof Ref) return `${v.num} 0 R`;
  if (v instanceof Raw) return v.text;
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return formatString(v);
  if (Array.isArray(v)) return `[${v.map(serialize).join(' ')}]`;
  const parts: string[] = [];
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) parts.push(`${escapeName(k)} ${serialize(val)}`);
  }
  return `<< ${parts.join(' ')} >>`;
}
