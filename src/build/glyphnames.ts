// Adobe Glyph List names.
const PUNCT: Record<string, string> = {
  ' ': 'space',
  '!': 'exclam',
  '"': 'quotedbl',
  '#': 'numbersign',
  $: 'dollar',
  '%': 'percent',
  '&': 'ampersand',
  "'": 'quotesingle',
  '(': 'parenleft',
  ')': 'parenright',
  '*': 'asterisk',
  '+': 'plus',
  ',': 'comma',
  '-': 'hyphen',
  '.': 'period',
  '/': 'slash',
  ':': 'colon',
  ';': 'semicolon',
  '<': 'less',
  '=': 'equal',
  '>': 'greater',
  '?': 'question',
  '@': 'at',
  '[': 'bracketleft',
  '\\': 'backslash',
  ']': 'bracketright',
  '^': 'asciicircum',
  _: 'underscore',
  '`': 'grave',
  '{': 'braceleft',
  '|': 'bar',
  '}': 'braceright',
  '~': 'asciitilde',
};
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export function glyphName(ch: string): string {
  if (/[A-Za-z]/.test(ch)) return ch;
  if (/[0-9]/.test(ch)) return DIGITS[Number(ch)]!;
  const n = PUNCT[ch];
  if (!n) throw new Error(`No glyph name for ${JSON.stringify(ch)}`);
  return n;
}
