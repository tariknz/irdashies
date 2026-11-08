import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WIDGET_PREVIEW_IPC } from '../../types/widgetPreview';

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>()
);
const runtimes = vi.hoisted(
  () =>
    [] as {
      dispose: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      hide: ReturnType<typeof vi.fn>;
      show: ReturnType<typeof vi.fn>;
    }[]
);
const window = new EventEmitter();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) =>
      handlers.set(name, callback),
    removeHandler: (name: string) => handlers.delete(name),
  },
  BrowserWindow: { fromWebContents: () => window },
}));
vi.mock('../perfMetrics', () => ({ TelemetryPerfMetrics: vi.fn() }));
vi.mock('../logger', () => ({ default: { error: vi.fn() } }));
vi.mock('./widgetPreviewRuntime', () => ({
  createWidgetPreviewRuntime: () => {
    const runtime = {
      dispose: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      getSession: () => ({ DriverInfo: {} }),
    };
    runtimes.push(runtime);
    return runtime;
  },
}));
import { setupWidgetPreviewBridge } from './widgetPreviewBridge';

let dispose: () => void;
beforeEach(() => {
  runtimes.length = 0;
  dispose = setupWidgetPreviewBridge();
});
afterEach(() => dispose());

const client = (id: number) => {
  const sender = Object.assign(new EventEmitter(), {
    id,
    mainFrame: {},
    send: vi.fn(),
    isDestroyed: () => false,
  });
  return { sender, senderFrame: sender.mainFrame };
};
const invoke = (method: keyof typeof WIDGET_PREVIEW_IPC, ...args: unknown[]) =>
  handlers.get(WIDGET_PREVIEW_IPC[method])?.(...args);

describe('widget preview IPC', () => {
  it('requires the main frame and validates channel names and rate types', () => {
    const event = client(1);
    expect(() => invoke('connect', { ...event, senderFrame: {} })).toThrow(
      'main frame'
    );
    invoke('connect', event);
    expect(() => invoke('subscribe', event, '__proto__')).toThrow('channel');
    expect(() =>
      invoke('subscribe', event, 'track-state.snapshot', NaN)
    ).toThrow('rate');
    expect(() =>
      invoke('subscribe', event, 'track-state.snapshot', '5')
    ).toThrow('rate');
    invoke('subscribe', event, 'track-state.snapshot', 5);
    expect(runtimes[0].subscribe).toHaveBeenCalledWith(
      'track-state.snapshot',
      5
    );
  });

  it('keeps windows separate and disposes on disconnect, navigation, and destruction', () => {
    const first = client(1),
      second = client(2);
    invoke('connect', first);
    invoke('connect', second);
    first.sender.emit('did-start-navigation', {}, 'about:blank', false, false);
    expect(runtimes[0].dispose).not.toHaveBeenCalled();
    first.sender.emit('did-start-navigation', {}, 'about:blank', false, true);
    expect(runtimes[0].dispose).toHaveBeenCalledOnce();
    expect(runtimes[1].dispose).not.toHaveBeenCalled();
    second.sender.emit('destroyed');
    expect(runtimes[1].dispose).toHaveBeenCalledOnce();
    expect(window.listenerCount('hide')).toBe(0);
  });
});
