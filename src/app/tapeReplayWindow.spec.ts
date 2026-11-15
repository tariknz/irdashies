import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';

vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');

vi.mock('electron', () => ({
  BrowserWindow: class extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
    });
    visible = false;
    destroyed = false;
    showInactive = vi.fn(() => {
      this.visible = true;
    });
    isVisible = () => this.visible;
    isDestroyed = () => this.destroyed;
    setAlwaysOnTop = vi.fn();
    setVisibleOnAllWorkspaces = vi.fn();
    loadURL = vi.fn(async () => undefined);
    loadFile = vi.fn(async () => undefined);

    constructor(public options: BrowserWindowConstructorOptions) {
      super();
    }
  },
  screen: {
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 0, width: 1512, height: 982 },
    }),
  },
}));

import { createTapeReplayWindow } from './tapeReplayWindow';

describe('tape replay window startup', () => {
  afterEach(() => createTapeReplayWindow().emit('closed'));

  it('reveals the controls after loading even when the hidden renderer never signals its first paint', () => {
    const window = createTapeReplayWindow();
    expect(window.isVisible()).toBe(false);

    window.webContents.emit('did-finish-load');

    expect(window.isVisible()).toBe(true);
  });

  it('shows on first paint without showing again when loading finishes', () => {
    const window = createTapeReplayWindow();
    window.emit('ready-to-show');
    expect(window.isVisible()).toBe(true);

    window.webContents.emit('did-finish-load');

    expect(window.showInactive).toHaveBeenCalledTimes(1);
    expect(createTapeReplayWindow()).toBe(window);
  });

  it('ignores pending startup events after the window is destroyed', () => {
    const window = createTapeReplayWindow();
    vi.spyOn(window, 'isDestroyed').mockReturnValue(true);

    window.webContents.emit('did-finish-load');
    window.emit('ready-to-show');

    expect(window.showInactive).not.toHaveBeenCalled();
    window.emit('closed');
  });
});
