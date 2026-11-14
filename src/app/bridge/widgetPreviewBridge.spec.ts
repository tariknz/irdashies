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
      setRunning: ReturnType<typeof vi.fn>;
      /** The target's visibility each time the bus was told it changed. */
      shown: boolean[];
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
    const shown: boolean[] = [];
    const runtime = {
      target,
      shown,
      dispose: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      setRunning: vi.fn(),
      show: () => shown.push(target.isVisible()),
      hide: () => shown.push(target.isVisible()),
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
/** What each runtime was told, oldest first. */
const runs = (index: number) =>
  runtimes[index].setRunning.mock.calls.map(([running]) => running);

let dispose: (() => void) | undefined;
const setup = (driving?: PreviewDrivingSource) => {
  dispose = setupWidgetPreviewBridge(undefined, driving);
};
beforeEach(() => {
  runtimes.length = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  windows.clear();
  vi.useRealTimers();
});

describe('widget preview IPC', () => {
  it('requires the main frame and validates channels, rates, the pause flag and the status key', () => {
    setup();
    const page = client(1);
    const subframe = { event: { ...page.event, senderFrame: {} } };
    expect(() => invoke('connect', subframe)).toThrow('main frame');
    expect(() => invoke('setPaused', subframe, true)).toThrow('main frame');
    expect(() => invoke('playInCar', subframe)).toThrow('main frame');
    expect(() => invoke('subscribe', page, 'track-state.snapshot')).toThrow(
      'not connected'
    );
    expect(() => invoke('unsubscribe', page, '__proto__')).toThrow('channel');
    for (const paused of ['yes', 1, null, undefined, {}])
      expect(() => invoke('setPaused', page, paused)).toThrow('pause');
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
        playInCar: false,
        running: false,
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
});

describe('pausing the demo in place', () => {
  it('runs a connected demo and pauses it while its window is hidden, gating its delivery the same way', () => {
    setup();
    const page = client(1);
    subscribe(page);
    invoke('connect', page);
    expect(runtimes).toHaveLength(1);
    expect(latest(page)).toMatchObject({ windowHidden: false, running: true });
    expect(runtimes[0].target.isVisible()).toBe(true);

    page.window.emit('minimize');
    expect(runs(0)).toEqual([false]);
    expect(latest(page)).toMatchObject({ windowHidden: true, running: false });
    page.window.emit('restore');
    page.window.emit('hide');
    page.window.emit('show');
    expect(runs(0)).toEqual([false, true, false, true]);
    // The bus is told after the state it reads has changed.
    expect(runtimes[0].shown).toEqual([false, true, false, true]);
    expect(runtimes[0].dispose).not.toHaveBeenCalled();
    expect(latest(page)?.running).toBe(true);

    invoke('disconnect', page);
    expect(latest(page)?.running).toBe(false);
  });

  it('pauses every window while the player is in the car, until they get out or the sim goes away', () => {
    const sim = lifecycle();
    setup(sim.source);
    const first = client(1);
    const second = client(2);
    for (const page of [first, second]) {
      subscribe(page);
      invoke('connect', page);
    }
    sim.drive(true);
    sim.drive(true);
    sim.drive(false);
    sim.drive(true);
    sim.disconnect();
    for (const [index, page] of [first, second].entries()) {
      expect(runs(index)).toEqual([false, true, false, true]);
      expect(statuses(page).map((status) => status.driving)).toEqual([
        false,
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
    expect(latest(page)).toEqual({
      windowHidden: false,
      driving: true,
      playInCar: false,
      running: false,
    });
  });

  it("keeps the page's own pause per window and applies it to the next demo", () => {
    setup();
    const paused = client(1);
    const other = client(2);
    invoke('setPaused', paused, true);
    subscribe(paused);
    invoke('connect', paused);
    invoke('connect', other);
    expect(runs(0)).toEqual([false]);
    expect(runs(1)).toEqual([]);
    expect(latest(paused)?.running).toBe(false);

    invoke('setPaused', paused, false);
    expect(runs(0)).toEqual([false, true]);
    invoke('setPaused', paused, true);
    invoke('disconnect', paused);
    invoke('connect', paused);
    expect(runtimes).toHaveLength(3);
    expect(runs(2)).toEqual([false]);
  });
});

describe('a demo connected while held', () => {
  it('stays held from the start, with no warm-up, until it is let go', () => {
    setup();
    const page = client(1);
    subscribe(page);
    invoke('setPaused', page, true);
    invoke('connect', page);
    // One demo, decided at connect: never created and then replaced.
    expect(runtimes).toHaveLength(1);
    expect(runs(0)).toEqual([false]);
    expect(latest(page)?.running).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(runs(0)).toEqual([false]);
    expect(vi.getTimerCount()).toBe(0);

    invoke('setPaused', page, false);
    expect(runs(0)).toEqual([false, true]);
    expect(latest(page)?.running).toBe(true);
    expect(runtimes[0].dispose).not.toHaveBeenCalled();
  });

  it("holds the next widget page's demo in the car until Play", () => {
    const sim = lifecycle(true);
    setup(sim.source);
    const page = client(1);
    subscribe(page);
    invoke('connect', page);
    // Another widget page: the preview remounts with a new demo.
    invoke('disconnect', page);
    invoke('connect', page);
    expect(runs(1)).toEqual([false]);
    expect(latest(page)).toMatchObject({ driving: true, running: false });

    invoke('playInCar', page);
    expect(runs(1)).toEqual([false, true]);
    expect(latest(page)).toMatchObject({ playInCar: true, running: true });
  });

  it('starts a demo connected in a hidden window once the window is shown', () => {
    setup();
    const page = client(1);
    page.window.visible = false;
    subscribe(page);
    invoke('connect', page);
    expect(runs(0)).toEqual([false]);
    page.window.emit('show');
    expect(runs(0)).toEqual([false, true]);
  });
});

describe('Play in the car', () => {
  it("only works while the player is in the car, for that window's current widget", () => {
    const sim = lifecycle();
    setup(sim.source);
    const first = client(1);
    const second = client(2);
    invoke('playInCar', first);
    for (const page of [first, second]) {
      subscribe(page);
      invoke('connect', page);
    }
    expect(latest(first)?.playInCar).toBe(false);

    sim.drive(true);
    invoke('playInCar', first);
    expect(latest(first)).toMatchObject({ playInCar: true, running: true });
    expect(latest(second)).toMatchObject({ playInCar: false, running: false });
    expect(runs(0)).toEqual([false, true]);

    // The page moves to another widget: its preview unmounts and remounts,
    // and the new widget arrives held while the player is still in the car.
    unsubscribe(first);
    invoke('disconnect', first);
    expect(first.window.listenerTotal()).toBe(0);
    subscribe(first);
    invoke('connect', first);
    expect(latest(first)).toMatchObject({ playInCar: false, running: false });
    expect(runs(2)).toEqual([false]);
    invoke('playInCar', first);
    expect(latest(first)).toMatchObject({ playInCar: true, running: true });

    // A Play pressed on the next widget before its frame connects counts.
    invoke('disconnect', first);
    invoke('playInCar', first);
    invoke('connect', first);
    expect(latest(first)).toMatchObject({ playInCar: true, running: true });
    expect(runs(3)).toEqual([]);

    // Getting out ends it, for every window; the next time in pauses again.
    sim.drive(false);
    expect(latest(first)?.playInCar).toBe(false);
    sim.drive(true);
    expect(latest(first)?.running).toBe(false);
    invoke('playInCar', first);
    sim.disconnect();
    expect(latest(first)).toMatchObject({ playInCar: false, driving: false });
  });
});

describe('releasing windows', () => {
  it('lets go of the window once nothing uses it, keeping only what the page chose', () => {
    const sim = lifecycle();
    setup(sim.source);
    const page = client(1);
    subscribe(page);
    expect(page.window.listenerTotal()).toBe(WINDOW_EVENTS.length);
    unsubscribe(page);
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBe(0);

    invoke('connect', page);
    invoke('disconnect', page);
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBe(0);

    // A pause or Play in the car outlives the preview, not the page.
    invoke('setPaused', page, true);
    sim.drive(true);
    invoke('playInCar', page);
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBeGreaterThan(0);
    page.navigate();
    expect(page.pageListeners()).toBe(0);
    subscribe(page);
    expect(latest(page)).toMatchObject({ playInCar: false });
  });

  it('releases everything on dispose', () => {
    const sim = lifecycle();
    const stop = setupWidgetPreviewBridge(undefined, sim.source);
    const page = client(1);
    subscribe(page);
    invoke('setPaused', page, true);
    invoke('connect', page);
    stop();
    expect(handlers.size).toBe(0);
    expect(page.window.listenerTotal()).toBe(0);
    expect(page.pageListeners()).toBe(0);
    expect(sim.listeners()).toBe(0);
    expect(runtimes[0].dispose).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
