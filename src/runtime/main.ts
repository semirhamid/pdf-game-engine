import { createApp, type App, type Host } from './app.ts';
import { F, KEY_REST } from './fields.ts';
import { intentFromButton, intentFromListBox } from './input.ts';

// The small part of the Acrobat JavaScript API the game uses. Nothing outside this file
// knows it's running in a PDF.
interface PdfField {
  value: string;
  display: number;
  currentValueIndices: number;
  setFocus(): void;
}
interface PdfDoc {
  getField(name: string): PdfField | null;
}
interface PdfEvent {
  change: string;
  willCommit: boolean;
}
declare const app: {
  viewerType: string;
  setTimeOut(code: string, ms: number): unknown;
};

const SHOWN = 0;
const HIDDEN = 1;

export interface Binding {
  boot(): void;
  key(event: PdfEvent): void;
  button(id: string): void;
  settle(): void;
  focus(focused: boolean): void;
}

export function bind(doc: PdfDoc): Binding {
  const cache: { [name: string]: PdfField } = {};
  let game: App;
  let booted = false;
  let refocusing = false;

  function field(name: string): PdfField {
    const found = cache[name] || doc.getField(name);
    if (!found) throw new Error('missing field ' + name);
    cache[name] = found;
    return found;
  }

  // The selection has to go back to the middle after every key, or Up after Left looks the
  // same as Left. PDFium ignores the change while the list box has focus, so leave and return.
  function resetKeyboard(): void {
    refocusing = true;
    try {
      field(F.sink).setFocus();
      field(F.keyboard).currentValueIndices = KEY_REST;
      field(F.keyboard).setFocus();
    } finally {
      refocusing = false;
    }
    // The viewer skips focus events while one of our actions is running.
    game.keyboard(true);
  }

  const host: Host = {
    mode: app.viewerType === 'pdfium' ? 'tiles' : 'ascii',
    setValue(name, value) {
      field(name).value = value;
    },
    setVisible(name, visible) {
      field(name).display = visible ? SHOWN : HIDDEN;
    },
    now: () => new Date().getTime(),
    readSeed: () => String(field(F.seedInput).value),
    focusKeyboard: resetKeyboard,
    scheduleSettle(ms) {
      app.setTimeOut('PD.settle()', ms);
    },
  };
  game = createApp(host);

  // Viewers swallow script errors, so put them in the message log.
  function guard(action: () => void): void {
    try {
      action();
    } catch (err) {
      try {
        field(F.message + 0).value = 'ERROR ' + err;
      } catch (_) {
        // nowhere left to show it
      }
    }
  }

  return {
    boot() {
      if (booted) return;
      booted = true;
      guard(() => {
        field(F.noScript).display = HIDDEN;
        game.boot();
      });
    },
    key(event) {
      if (event.willCommit || refocusing) return;
      guard(() => {
        const intent = intentFromListBox(String(event.change));
        resetKeyboard();
        if (intent) game.intent(intent);
      });
    },
    button(id) {
      guard(() => {
        const screen = () => game.snapshot().ui.screen;
        // Clicking the map only does something when a screen is covering it.
        const mapClick = screen() === 'playing' ? null : 'confirm';
        const intent = id === 'board' ? mapClick : intentFromButton(id);
        if (intent) game.intent(intent);
        if (screen() !== 'title') resetKeyboard();
      });
    },
    settle() {
      guard(game.settle);
    },
    focus(focused) {
      if (!refocusing) guard(() => game.keyboard(focused));
    },
  };
}
