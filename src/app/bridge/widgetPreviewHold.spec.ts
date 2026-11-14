import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WIDGET_PREVIEW_IPC,
  type WidgetPreviewHold,
} from '../../types/widgetPreview';

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>()
);
const windows = vi.hoisted(() => new Map<number, unknown>());
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) =>
      handlers.set(name, callback),
    removeHandler: (name: string) => handlers.delete(name),
  },
  BrowserWindow: {
    fromWebContents: (contents: { id: number }) => windows.get(contents.id),
  },
}));
import {
  setupWidgetPreviewHold,
  type PreviewDrivingSource,
} from './widgetPreviewHold';

class FakeWindow extends EventEmitter {
  visible = true;
  minimized = false;
  isVisible = () => this.visible;
  isMinimized = () => this.minimized;
  isDestroyed = () => false;
}

const renderer = (id: number) => {
  const window = new FakeWindow();
  windows.set(id, window);
  const sender = Object.assign(new EventEmitter(), {
    id,
    send: vi.fn(),
    isDestroyed: () => false,
  });
  return { window, sender, event: { sender } };
};

const lifecycle = (initial?: boolean) => {
  const driving = new Set<(isDriving: boolean) => void>();
  const disconnect = new Set<() => void>();
  const source: PreviewDrivingSource = {
    onDrivingStateChange: (callback) => {
      driving.add(callback);
      return () => driving.delete(callback);
    },
    onDisconnect: (callback) => {
      disconnect.add(callback);
      return () => disconnect.delete(callback);
    },
    getCurrentState: () => ({ isDriving: initial }),
  };
  return {
    source,
    drive: (value: boolean) => driving.forEach((callback) => callback(value)),
    disconnect: () => disconnect.forEach((callback) => callback()),
    listeners: () => driving.size + disconnect.size,
  };
};

const subscribe = (event: unknown, key: unknown = 'hold') =>
  handlers.get('widget-preview-hold:subscribe')?.(event, key);
const unsubscribe = (event: unknown, key: unknown = 'hold') =>
  handlers.get('widget-preview-hold:unsubscribe')?.(event, key);

/** Every hold sent to a renderer, oldest first. */
const holds = (sender: { send: ReturnType<typeof vi.fn> }) =>
  sender.send.mock.calls.map(([channel, hold]) => {
    expect(channel).toBe(WIDGET_PREVIEW_IPC.hold);
    return hold as WidgetPreviewHold;
  });

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  windows.clear();
});

describe('widget preview hold', () => {
  it('sends the hold on subscribe, then whenever the window is minimised, hidden or brought back', () => {
    dispose = setupWidgetPreviewHold();
    const { window, sender, event } = renderer(1);
    subscribe(event);
    // The window's own state is left as visible throughout: the events that
    // hide it are believed even before Electron updates what it reports.
    window.emit('minimize');
    window.emit('restore');
    window.emit('hide');
    window.emit('show');
    expect(holds(sender).map((hold) => hold.windowHidden)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(holds(sender).every((hold) => !hold.driving)).toBe(true);
  });

  it('reports a window that starts minimised or in the tray as hidden', () => {
    dispose = setupWidgetPreviewHold();
    const tray = renderer(1);
    tray.window.visible = false;
    subscribe(tray.event);
    const minimised = renderer(2);
    minimised.window.minimized = true;
    subscribe(minimised.event);
    expect(holds(tray.sender)).toEqual([
      { windowHidden: true, driving: false },
    ]);
    expect(holds(minimised.sender)).toEqual([
      { windowHidden: true, driving: false },
    ]);
  });

  it('holds every subscribed window while the player is in the car, until they get out or the sim goes away', () => {
    const source = lifecycle();
    dispose = setupWidgetPreviewHold(source.source);
    const first = renderer(1);
    const second = renderer(2);
    subscribe(first.event);
    subscribe(second.event);
    source.drive(true);
    source.drive(true);
    source.drive(false);
    source.drive(true);
    source.disconnect();
    for (const { sender } of [first, second]) {
      expect(holds(sender).map((hold) => hold.driving)).toEqual([
        false,
        true,
        false,
        true,
        false,
      ]);
    }
  });

  it('knows the player is already in the car when it starts', () => {
    dispose = setupWidgetPreviewHold(lifecycle(true).source);
    const { sender, event } = renderer(1);
    subscribe(event);
    expect(holds(sender)).toEqual([{ windowHidden: false, driving: true }]);
  });

  it('rejects other keys and sends nothing to a window that unsubscribed or whose page is gone', () => {
    const source = lifecycle();
    dispose = setupWidgetPreviewHold(source.source);
    const { window, sender, event } = renderer(1);
    expect(() => subscribe(event, 'status')).toThrow('Invalid');
    expect(() => unsubscribe(event, '__proto__')).toThrow('Invalid');
    subscribe(event);
    unsubscribe(event);
    window.emit('minimize');
    source.drive(true);
    expect(holds(sender)).toHaveLength(1);

    const gone = renderer(2);
    subscribe(gone.event);
    gone.sender.emit('destroyed');
    expect(gone.window.listenerCount('minimize')).toBe(0);
    source.drive(false);
    expect(holds(gone.sender)).toHaveLength(1);
  });

  it('releases its handlers, window listeners and lifecycle callbacks on dispose', () => {
    const source = lifecycle();
    const stop = setupWidgetPreviewHold(source.source);
    const { window, event } = renderer(1);
    subscribe(event);
    stop();
    expect(handlers.has('widget-preview-hold:subscribe')).toBe(false);
    expect(handlers.has('widget-preview-hold:unsubscribe')).toBe(false);
    for (const name of ['show', 'hide', 'minimize', 'restore']) {
      expect(window.listenerCount(name)).toBe(0);
    }
    expect(source.listeners()).toBe(0);
  });
});
