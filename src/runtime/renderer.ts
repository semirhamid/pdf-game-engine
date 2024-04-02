import type { Frame } from './scene.ts';

export interface RenderTarget {
  setValue(field: string, value: string): void;
  setVisible(field: string, visible: boolean): void;
}

export interface RenderStats {
  writes: number;
  total: number;
}

export interface Renderer {
  draw(frame: Frame): RenderStats;
  invalidate(): void;
}

// Every field write makes the viewer rebuild and repaint that field, so only write what changed.
export function createRenderer(target: RenderTarget): Renderer {
  let values: Frame['values'] = {};
  let visible: Frame['visible'] = {};

  return {
    draw(frame) {
      let writes = 0;
      const valueNames = Object.keys(frame.values);
      const flagNames = Object.keys(frame.visible);

      for (const name of valueNames) {
        const value = frame.values[name]!;
        if (values[name] === value) continue;
        values[name] = value;
        target.setValue(name, value);
        writes++;
      }
      // Overlays go last so they never open onto a half-drawn board.
      for (const name of flagNames) {
        const shown = frame.visible[name]!;
        if (visible[name] === shown) continue;
        visible[name] = shown;
        target.setVisible(name, shown);
        writes++;
      }
      return { writes, total: valueNames.length + flagNames.length };
    },
    invalidate() {
      values = {};
      visible = {};
    },
  };
}
