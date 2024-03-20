// Which character draws which tile. They follow the usual roguelike letters so the plain-text
// renderer can show the same strings.
export const TILE = {
  void: ' ',
  floorA: '.',
  floorB: ',',
  floorC: ':',
  wallTop: '=',
  wallFace: '#',
  wallTorch: '%',
  door: '+',
  doorOpen: '/',
  locked: 'X',
  stairs: '>',
} as const;

// The same tiles, remembered but out of sight.
export const TILE_DIM: { [K in keyof typeof TILE]: string } = {
  void: ' ',
  floorA: 'a',
  floorB: 'b',
  floorC: 'c',
  wallTop: 'd',
  wallFace: 'e',
  wallTorch: 'f',
  door: 'g',
  doorOpen: 'h',
  locked: 'i',
  stairs: 'j',
};

export const ACTOR = {
  none: ' ',
  hero: '@',
  slime: 's',
  bat: 'b',
  skeleton: 'k',
  warden: 'W',
  key: 'f',
  coin: '$',
  gem: '*',
  potion: '!',
  sword: ')',
  shield: ']',
  crown: '&',
  heroHurt: 'H',
  slimeHurt: 'S',
  batHurt: 'B',
  skeletonHurt: 'K',
  wardenHurt: 'D',
  heart: '1',
  heartHalf: '2',
  heartEmpty: '3',
  bitOff: '0',
  bitOn: '9', // test strip, see telemetryBits
} as const;
