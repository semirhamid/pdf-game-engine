import { KEY_OPTIONS, type Intent } from './fields.ts';

const KEYS: { [label: string]: Intent } = {
  '<': 'left',
  '>': 'right',
  '^': 'up',
  _: 'down',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  ' ': 'confirm',
  '.': 'wait',
  q: 'potion',
  h: 'help',
  n: 'new',
  r: 'retry',
  p: 'debug',
};

const BUTTONS: { [id: string]: Intent } = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  wait: 'wait',
  potion: 'potion',
  help: 'help',
  new: 'new',
  retry: 'retry',
  start: 'confirm',
};

export function intentFromListBox(label: string): Intent | null {
  return KEY_OPTIONS.indexOf(label) === -1 ? null : KEYS[label] || null;
}

export function intentFromButton(id: string): Intent | null {
  return BUTTONS[id] || null;
}

// Blank means random, a number is used as is, and any other text is hashed.
export function parseSeed(input: string, now: number): number {
  const text = input.replace(/^\s+|\s+$/g, '').toUpperCase();
  if (!text) return (now ^ (now / 4294967296)) & 0x7fffffff || 1;
  if (/^\d{1,9}$/.test(text)) return parseInt(text, 10) || 1;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
}
