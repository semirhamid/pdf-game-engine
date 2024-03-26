// PDF form field names, used by both the script inside the PDF and the code that builds it.
export const F = {
  terrain: 't',
  actor: 'a',
  ascii: 'x',
  message: 'm',
  hearts: 'hearts',
  hpText: 'hptext',
  attack: 'attack',
  defence: 'defence',
  keys: 'keys',
  potions: 'potions',
  floor: 'floor',
  score: 'score',
  best: 'best',
  seed: 'seed',
  kbStatus: 'kbstatus',
  debug: 'debug',
  bits: 'bits',
  noScript: 'noscript',
  keyboard: 'kb',
  sink: 'sink',
  seedInput: 'seedin',
  board: 'board',
  title: 'ovtitle',
  help: 'ovhelp',
  dead: 'ovdead',
  won: 'ovwon',
  result1: 'result1',
  result2: 'result2',
} as const;

export const MESSAGE_LINES = 3;

// The keyboard is a list box (see main.ts). Left and Right jump to the first and last option,
// Up and Down step off KEY_REST, and letters jump to the option they name.
export const KEY_OPTIONS = ['<', ...'wasdqhnrp .'.split(''), '^', '=', '_', '>'];
export const KEY_REST = KEY_OPTIONS.indexOf('=');

export type Intent =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'wait'
  | 'potion'
  | 'help'
  | 'new'
  | 'retry'
  | 'debug'
  | 'confirm';
