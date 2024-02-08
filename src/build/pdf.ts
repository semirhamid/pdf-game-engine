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
