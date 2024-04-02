import { hashState, newGame, step } from '../engine/game.ts';
import type { Action, GameState } from '../engine/types.ts';
import type { Intent } from './fields.ts';
import { parseSeed } from './input.ts';
import { createRenderer, type RenderTarget } from './renderer.ts';
import { buildFrame, describe, type Mode, type Ui } from './scene.ts';

// What the game needs from whatever it's running in. Tests pass in a fake one.
export interface Host extends RenderTarget {
  mode: Mode;
  now(): number;
  readSeed(): string;
  focusKeyboard(): void;
  scheduleSettle(ms: number): void;
}

export interface App {
  boot(): void;
  intent(intent: Intent): void;
  settle(): void;
  keyboard(focused: boolean): void;
  snapshot(): { state: GameState | null; ui: Ui; hash: number };
}

const FLASH_MS = 120;
const MAX_MESSAGES = 8;

export function createApp(host: Host): App {
  const renderer = createRenderer(host);
  const ui: Ui = {
    screen: 'title',
    mode: host.mode,
    best: 0,
    messages: [],
    flash: [],
    keyboardFocused: false,
    debug: null,
  };
  let state: GameState | null = null;
  let debugOn = false;
  const perf = { sim: 0, draw: 0, max: 0, writes: 0, total: 0 };

  function draw(): void {
    // A frame can't time itself, so the panel shows the previous one.
    ui.debug = debugOn
      ? `SIM ${perf.sim}MS DRAW ${perf.draw}MS MAX ${perf.max}MS WRITES ${perf.writes}/${perf.total}`
      : null;
    const start = host.now();
    const stats = renderer.draw(buildFrame(state, ui));
    perf.draw = host.now() - start;
    perf.max = Math.max(perf.max, perf.draw);
    perf.writes = stats.writes;
    perf.total = stats.total;
  }

  function say(text: string): void {
    if (!text) return;
    ui.messages.push(text);
    if (ui.messages.length > MAX_MESSAGES) ui.messages.shift();
  }

  function show(screen: Ui['screen']): void {
    ui.screen = screen;
    draw();
  }

  function startGame(seed: number): void {
    state = newGame(seed);
    ui.messages = [];
    ui.flash = [];
    perf.max = 0;
    say('FIND THE KEY, THEN THE STAIRS.');
    show('playing');
    host.focusKeyboard();
  }

  function takeTurn(action: Action): void {
    if (!state) return;
    const start = host.now();
    step(state, action);
    perf.sim = host.now() - start;

    ui.flash = [];
    for (const event of state.events) {
      say(describe(event));
      if (event.type === 'hit' && event.id !== undefined) ui.flash.push(event.id);
      if (event.type === 'hurt') ui.flash.push(0);
    }
    if (state.status !== 'playing') {
      ui.best = Math.max(ui.best, state.score);
      ui.screen = state.status;
    }
    draw();
    if (ui.flash.length) host.scheduleSettle(FLASH_MS);
  }

  function onPlaying(intent: Intent): void {
    switch (intent) {
      case 'help':
        return show('help');
      case 'new':
        return show('title');
      case 'retry':
        if (state) startGame(state.seed);
        return;
      case 'confirm':
      case 'wait':
        return takeTurn('wait');
      case 'debug':
        return;
      default:
        takeTurn(intent);
    }
  }

  function onIntent(intent: Intent): void {
    if (intent === 'debug') {
      debugOn = !debugOn;
      draw();
      return;
    }
    switch (ui.screen) {
      case 'title':
        if (intent === 'confirm') startGame(parseSeed(host.readSeed(), host.now()));
        return;
      case 'help':
        return show('playing');
      case 'dead':
      case 'won':
        if (intent === 'retry' && state) startGame(state.seed);
        else if (intent === 'confirm' || intent === 'new') show('title');
        return;
      case 'playing':
        onPlaying(intent);
    }
  }

  return {
    boot: draw,
    intent: onIntent,
    settle() {
      if (!ui.flash.length) return;
      ui.flash = [];
      draw();
    },
    keyboard(focused) {
      if (ui.keyboardFocused === focused) return;
      ui.keyboardFocused = focused;
      draw();
    },
    snapshot: () => ({ state, ui, hash: state ? hashState(state) : 0 }),
  };
}
