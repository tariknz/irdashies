import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WIDGET_PREVIEW_IPC,
  type WidgetPreviewStatus,
} from '../../types/widgetPreview';
import type { RendererTarget } from './channelBus';

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>()
);
const windows = vi.hoisted(() => new Map<number, unknown>());
const runtimes = vi.hoisted(
  () =>
    [] as {
      target: RendererTarget;
      dispose: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
    }[]
);
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) =>
      handlers.set(name, callback),
    removeHandler: (name: string) => handlers.delete(name),
  },
  BrowserWindow: {
    fromWebContents: (contents: { id: number }) =>
      windows.get(contents.id) ?? null,
  },
}));
vi.mock('../perfMetrics', () => ({ TelemetryPerfMetrics: vi.fn() }));
vi.mock('../logger', () => ({ default: { error: vi.fn() } }));
vi.mock('./widgetPreviewRuntime', () => ({
  createWidgetPreviewRuntime: (target: RendererTarget) => {
    const runtime = {
      target,
      dispose: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getSession: () => ({ DriverInfo: {} }),
      getTelemetry: () => null,
    };
    runtimes.push(runtime);
    return runtime;
  },
}));
import {
  setupWidgetPreviewBridge,
  type PreviewDrivingSource,
} from './widgetPreviewBridge';

const WINDOW_EVENTS = ['minimize', 'restore', 'hide', 'show', 'focus'];

class FakeWindow extends EventEmitter {
  visible = true;
  minimized = false;
  isVisible = () => this.visible;
  isMinimized = () => this.minimized;
  isDestroyed = () => false;
  listenerTotal = () =>
    WINDOW_EVENTS.reduce((sum, name) => sum + this.listenerCount(name), 0);
}

const client = (id: number) => {
  const window = new FakeWindow();
  windows.set(id, window);
  const sender = Object.assign(new EventEmitter(), {
    id,
    mainFrame: {},
    send: vi.fn(),
    isDestroyed: () => false,
  });
  const event = { sender, senderFrame: sender.mainFrame };
  return {
    window,
    sender,
    event,
    /** Listeners on the webContents, which watch for the page going away. */
    pageListeners: () =>
      sender.listenerCount('destroyed') +
      sender.listenerCount('did-start-navigation'),
    navigate: (isMainFrame = true, isInPlace = false) =>
      sender.emit('did-start-navigation', {
        isMainFrame,
        isSameDocument: isInPlace,
      }),
  };
};
type Client = ReturnType<typeof client>;

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

const invoke = (
  method: keyof typeof WIDGET_PREVIEW_IPC,
  { event }: Pick<Client, 'event'>,
  ...args: unknown[]
) => handlers.get(WIDGET_PREVIEW_IPC[method])?.(event, ...args);
const subscribe = ({ event }: Client, key: unknown = 'status') =>
  handlers.get('widget-preview-status:subscribe')?.(event, key);
const unsubscribe = ({ event }: Client, key: unknown = 'status') =>
  handlers.get('widget-preview-status:unsubscribe')?.(event, key);

/** Every status sent to a page, oldest first. */
const statuses = ({ sender }: Client) =>
  sender.send.mock.calls
    .filter(([channel]) => channel === WIDGET_PREVIEW_IPC.status)
    .map(([, status]) => status as WidgetPreviewStatus);
const latest = (page: Client) => statuses(page).at(-1);

let dispose: (() => void) | undefined;
const setup = (driving?: PreviewDrivingSource) => {
  dispose = setupWidgetPreviewBridge(undefined, driving);
};
beforeEach(() => {
  runtimes.length = 0;
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  windows.clear();
});

describe('widget preview IPC', () => {
  it('requires the main frame and validates channels, rates and the status key', () => {
    setup();
    const page = client(1);
    const subframe = { event: { ...page.event, senderFrame: {} } };
    expect(() => invoke('connect', subframe)).toThrow('main frame');
    expect(() => invoke('disconnect', subframe)).toThrow('main frame');
    expect(() => invoke('subscribe', page, 'track-state.snapshot')).toThrow(
      'not connected'
    );
    expect(() => invoke('unsubscribe', page, '__proto__')).toThrow('channel');
    expect(() => subscribe(page, 'hold')).toThrow('Invalid');
    expect(() => unsubscribe(page, '__proto__')).toThrow('Invalid');

    invoke('connect', page);
    expect(() => invoke('subscribe', page, '__proto__')).toThrow('channel');
    expect(() =>
      invoke('subscribe', page, 'track-state.snapshot', NaN)
    ).toThrow('rate');
    expect(() =>
      invoke('subscribe', page, 'track-state.snapshot', '5')
    ).toThrow('rate');
    invoke('subscribe', page, 'track-state.snapshot', 5);
    expect(runtimes[0].subscribe).toHaveBeenCalledWith(
      'track-state.snapshot',
      5
    );
  });

  it('keeps windows separate and disposes on disconnect, navigation, and destruction', () => {
    setup();
    const first = client(1);
    const second = client(2);
    const third = client(3);
    invoke('connect', first);
    invoke('connect', second);
    invoke('connect', third);
    first.navigate(false);
    first.navigate(true, true);
    expect(runtimes[0].dispose).not.toHaveBeenCalled();
    first.navigate();
    expect(runtimes[0].dispose).toHaveBeenCalledOnce();
    expect(runtimes[1].dispose).not.toHaveBeenCalled();
    second.sender.emit('destroyed');
    expect(runtimes[1].dispose).toHaveBeenCalledOnce();
    invoke('disconnect', third);
    expect(runtimes[2].dispose).toHaveBeenCalledOnce();
    for (const { window } of [first, second, third])
      expect(window.listenerTotal()).toBe(0);
  });

  it('starts a new demo on each connect, replacing the previous one, and always delivers to it', () => {
    setup();
    const page = client(1);
    invoke('connect', page);
    invoke('connect', page);
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0].dispose).toHaveBeenCalledOnce();
    expect(runtimes[1].dispose).not.toHaveBeenCalled();
    // The page stops its demo whenever the preview is not shown.
    subscribe(page);
    page.window.emit('minimize');
    expect(runtimes[1].target.isVisible()).toBe(true);
  });
});

describe('widget preview status', () => {
  it('sends the status on subscribe, then on each change, from the window events alone', () => {
    setup();
    const page = client(1);
    subscribe(page);
    // The window's own state is left as visible throughout: the events are
    // believed even before Electron updates what the window reports.
    page.window.emit('minimize');
    page.window.emit('restore');
    page.window.emit('hide');
    page.window.emit('hide');
    page.window.emit('show');
    expect(statuses(page)).toEqual(
      [false, true, false, true, false].map((windowHidden) => ({
        windowHidden,
        driving: false,
      }))
    );

    // Every subscribe is answered, for a new consumer in the page.
    subscribe(page);
    expect(statuses(page)).toHaveLength(6);
  });

  it('treats a focused window as visible whatever events were missed', () => {
    setup();
    const page = client(1);
    subscribe(page);
    page.window.emit('minimize');
    page.window.emit('hide');
    page.window.emit('focus');
    expect(statuses(page).map((status) => status.windowHidden)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('starts from the window state: in the tray, or minimised until restored', () => {
    setup();
    const tray = client(1);
    tray.window.visible = false;
    subscribe(tray);
    const minimised = client(2);
    minimised.window.minimized = true;
    minimised.window.visible = false;
    subscribe(minimised);
    expect(latest(tray)?.windowHidden).toBe(true);
    expect(latest(minimised)?.windowHidden).toBe(true);
    minimised.window.emit('restore');
    expect(latest(minimised)?.windowHidden).toBe(false);
  });

  it('keeps the subscription while the preview iframe loads, and drops it with the page', () => {
    setup();
    const page = client(1);
    subscribe(page);
    page.sender.emit('did-start-loading');
    page.navigate(false);
    page.window.emit('minimize');
    expect(statuses(page)).toHaveLength(2);

    page.navigate();
    page.window.emit('restore');
    expect(statuses(page)).toHaveLength(2);
    expect(page.window.listenerTotal()).toBe(0);
  });

  it('tells every window when the player gets in or out of the car, or the sim goes away', () => {
    const sim = lifecycle();
    setup(sim.source);
    const first = client(1);
    const second = client(2);
    subscribe(first);
    subscribe(second);
    sim.drive(true);
    sim.drive(true);
    sim.drive(false);
    sim.drive(true);
    sim.disconnect();
    for (const page of [first, second]) {
      expect(statuses(page).map((status) => status.driving)).toEqual([
        false,
        true,
        false,
        true,
        false,
      ]);
    }
  });

  it('knows the player is already in the car when it starts', () => {
    setup(lifecycle(true).source);
    const page = client(1);
    subscribe(page);
    expect(latest(page)).toEqual({ windowHidden: false, driving: true });
  });
});

describe('releasing windows', () => {
  it('lets go of the window once nothing uses it', () => {
    setup();
    const page = client(1);
    subscribe(page);
    expect(page.window.listenerTotal()).toBe(WINDOW_EVENTS.length);
    invoke('connect', page);
    unsubscribe(page);
    // The demo still connected keeps the page, but not its window watch.
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBeGreaterThan(0);
    invoke('disconnect', page);
    expect(page.pageListeners()).toBe(0);
  });

  it('releases everything on dispose', () => {
    const sim = lifecycle();
    const stop = setupWidgetPreviewBridge(undefined, sim.source);
    const page = client(1);
    subscribe(page);
    invoke('connect', page);
    stop();
    expect(handlers.size).toBe(0);
    expect(runtimes[0].dispose).toHaveBeenCalledOnce();
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBe(0);
    expect(sim.listeners()).toBe(0);
  });
});
