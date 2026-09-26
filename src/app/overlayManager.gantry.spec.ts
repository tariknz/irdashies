import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';

// `declare const` globals injected by the Forge/Vite plugin.
vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', undefined);
vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
vi.stubGlobal('APP_GIT_HASH', 'test');
// Only set inside a packaged Electron process; getIconPath() reads it.
if (!process.resourcesPath) {
  Object.defineProperty(process, 'resourcesPath', { value: '/resources' });
}

const createdWindows: FakeBrowserWindow[] = [];

class FakeWebContents {
  id = 42;
  send = vi.fn();
  on = vi.fn();
  setWindowOpenHandler = vi.fn();
}

class FakeBrowserWindow {
  static getAllWindows = vi.fn(() => []);
  static fromWebContents = vi.fn(
    (webContents: FakeWebContents) =>
      createdWindows.find((w) => w.webContents === webContents) ?? null
  );
  webContents = new FakeWebContents();
  destroyed = false;
  shown = false;
  focused = false;
  show = vi.fn(() => {
    this.shown = true;
  });
  focus = vi.fn(() => {
    this.focused = true;
  });
  hide = vi.fn();
  close = vi.fn();
  destroy = vi.fn(() => {
    this.destroyed = true;
  });
  isDestroyed = vi.fn(() => this.destroyed);
  isVisible = vi.fn(() => this.shown);
  isMinimized = vi.fn(() => false);
  restore = vi.fn();
  loadURL = vi.fn();
  loadFile = vi.fn();
  setBounds = vi.fn();
  setAlwaysOnTop = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  setVisibleOnAllWorkspaces = vi.fn();
  moveTop = vi.fn();
  once = vi.fn();
  on = vi.fn();

  constructor(public options: Record<string, unknown>) {
    createdWindows.push(this);
  }
}

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    getPath: () => '/tmp/irdashies-test',
    disableHardwareAcceleration: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: FakeBrowserWindow,
  Notification: vi.fn(),
  screen: {
    getAllDisplays: vi.fn(() => []),
    getPrimaryDisplay: vi.fn(() => ({ id: 1, bounds: {} })),
  },
}));

vi.mock('./storage/storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('./storage/dashboards', () => ({ getDashboard: vi.fn() }));
vi.mock('./storage/chromiumFlags', () => ({
  getChromiumFlags: vi.fn(() => ({})),
  parseCustomSwitches: vi.fn(() => []),
}));
vi.mock('./trackWindowMovement', () => ({
  trackSettingsWindowMovement: vi.fn(),
}));
vi.mock('./perfRendererArguments', () => ({
  createRendererPerfArguments: vi.fn(() => []),
}));
vi.mock('./hardenWindow', () => ({ hardenWindow: vi.fn() }));
const simWidgetSupport = vi.hoisted(() => ({
  message: 'This widget is not compatible with the running sim',
  disabledWidgets: { iracing: [] as string[], lmu: [] as string[] },
}));
vi.mock('./storage/simWidgetSupport', () => ({
  getSimWidgetSupport: () => simWidgetSupport,
}));
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { OverlayManager } = await import('./overlayManager');
const { hardenWindow } = await import('./hardenWindow');

const dashboard = (enabled: boolean, config: Record<string, unknown> = {}) =>
  ({ widgets: [{ id: 'gantry', enabled, config }] }) as DashboardLayout;

const pinned = (alwaysOnTop: unknown) =>
  dashboard(true, { window: { alwaysOnTop } });

const gantryWindows = () =>
  createdWindows.filter((w) => w.options.title === 'irDashies - Gantry');

describe('OverlayManager Gantry window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
    simWidgetSupport.disabledWidgets.iracing = [];
    simWidgetSupport.disabledWidgets.lmu = [];
  });

  it('stays shut when the running simulator cannot support the widget', () => {
    // The Gantry has its own window rather than an ordinary overlay, so it
    // needs the same visibility rule applied explicitly -- the enabled flag
    // alone would keep it open under a sim that cannot feed it.
    simWidgetSupport.disabledWidgets.iracing = ['gantry'];
    const manager = new OverlayManager();
    manager.setActiveSimulator('iracing');

    expect(manager.createGantryWindow(dashboard(true))).toBe(false);
    expect(gantryWindows()).toHaveLength(0);
  });

  it('closes an open window when the simulator stops supporting the widget', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    simWidgetSupport.disabledWidgets.iracing = ['gantry'];
    manager.setActiveSimulator('iracing');
    manager.syncGantryWindow(dashboard(true));

    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('is unaffected while no simulator is known', () => {
    simWidgetSupport.disabledWidgets.iracing = ['gantry'];
    const manager = new OverlayManager();

    expect(manager.createGantryWindow(dashboard(true))).toBe(true);
  });

  it('opens the window when the widget is switched on', () => {
    const manager = new OverlayManager();

    manager.syncGantryWindow(dashboard(false));
    expect(gantryWindows()).toHaveLength(0);

    manager.syncGantryWindow(dashboard(true));
    expect(gantryWindows()).toHaveLength(1);
  });

  it('closes the window when the widget is switched off', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    manager.syncGantryWindow(dashboard(false));

    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('closes the window when switching to a profile without the widget', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    manager.syncGantryWindow({ widgets: [] } as unknown as DashboardLayout);

    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('does not reopen a window the user closed while the widget stays enabled', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    // The 'closed' handler the manager registered clears its reference.
    const closedHandler = window.on.mock.calls.find(
      ([event]) => event === 'closed'
    )?.[1] as () => void;
    closedHandler();

    manager.syncGantryWindow(dashboard(true));

    expect(gantryWindows()).toHaveLength(1);
  });

  it('reports false from createGantryWindow when the widget is disabled', () => {
    const manager = new OverlayManager();

    expect(manager.createGantryWindow(dashboard(false))).toBe(false);
    expect(gantryWindows()).toHaveLength(0);
  });

  it('reports true and focuses an already-open window', () => {
    const manager = new OverlayManager();

    expect(manager.createGantryWindow(dashboard(true))).toBe(true);
    expect(manager.createGantryWindow(dashboard(true))).toBe(true);

    expect(gantryWindows()).toHaveLength(1);
    expect(gantryWindows()[0].focus).toHaveBeenCalledOnce();
  });

  it('hardens the window against popups and navigation', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true));

    expect(hardenWindow).toHaveBeenCalledWith(
      gantryWindows()[0],
      expect.objectContaining({ label: 'Gantry' })
    );
  });

  it('forwards bulk data only while visible and subscribed', () => {
    const manager = new OverlayManager();
    const subscriptions = {
      has: vi.fn(() => false),
      hasAny: vi.fn(() => false),
    };
    manager.setRendererDataSubscriptions(subscriptions);
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    manager.publishMessage('sessionData', { revision: 1 });
    expect(window.webContents.send).not.toHaveBeenCalled();

    window.shown = true;
    manager.publishMessage('sessionData', { revision: 2 });
    expect(window.webContents.send).not.toHaveBeenCalled();

    subscriptions.has.mockReturnValue(true);
    manager.publishMessage('sessionData', { revision: 3 });
    expect(window.webContents.send).toHaveBeenCalledWith('sessionData', {
      revision: 3,
    });
    expect(subscriptions.has).toHaveBeenCalledWith(42, 'sessionData');
  });

  it.each(['show', 'restore'])(
    'resends the latest session on %s to a subscribed window',
    (eventName) => {
      const manager = new OverlayManager();
      const subscriptions = {
        has: vi.fn(() => false),
        hasAny: vi.fn(() => false),
      };
      manager.setRendererDataSubscriptions(subscriptions);
      manager.createGantryWindow(dashboard(true));
      const [window] = gantryWindows();
      const handler = window.on.mock.calls.find(
        ([event]) => event === eventName
      )?.[1] as () => void;
      window.shown = true;

      // No cached session yet.
      handler();
      expect(window.webContents.send).not.toHaveBeenCalled();

      // Cached, but this window is not subscribed.
      manager.publishMessage('sessionData', { revision: 1 });
      handler();
      expect(window.webContents.send).not.toHaveBeenCalled();

      subscriptions.has.mockReturnValue(true);
      handler();
      expect(window.webContents.send).toHaveBeenCalledWith('sessionData', {
        revision: 1,
      });
    }
  );

  it('fires onOverlayReady callbacks as gantry when the page loads', () => {
    const manager = new OverlayManager();
    const onReady = vi.fn();
    manager.onOverlayReady(onReady);
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const loaded = window.webContents.on.mock.calls.find(
      ([event]) => event === 'did-finish-load'
    )?.[1] as () => void;

    loaded();
    expect(onReady).toHaveBeenCalledWith('gantry');

    onReady.mockClear();
    window.destroyed = true;
    loaded();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('seeds the cached session only to a visible subscribed window', () => {
    const manager = new OverlayManager();
    const subscriptions = {
      has: vi.fn(() => true),
      hasAny: vi.fn(() => false),
    };
    manager.setRendererDataSubscriptions(subscriptions);
    manager.publishMessage('sessionData', { revision: 1 });
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const sender = window.webContents as unknown as Electron.WebContents;

    // Hidden: nothing is sent.
    expect(manager.seedSessionData(sender)).toBe(false);
    expect(window.webContents.send).not.toHaveBeenCalled();

    window.shown = true;
    expect(manager.seedSessionData(sender)).toBe(true);
    expect(window.webContents.send).toHaveBeenCalledWith('sessionData', {
      revision: 1,
    });

    // Not subscribed: nothing is sent.
    window.webContents.send.mockClear();
    subscriptions.has.mockReturnValue(false);
    expect(manager.seedSessionData(sender)).toBe(false);
    expect(window.webContents.send).not.toHaveBeenCalled();

    // No owning window.
    const orphan = new FakeWebContents() as unknown as Electron.WebContents;
    expect(manager.seedSessionData(orphan)).toBe(false);
  });

  it('drops its reference when the renderer crashes so it can be recreated', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const crashHandler = window.webContents.on.mock.calls.find(
      ([event]) => event === 'render-process-gone'
    )?.[1] as (event: unknown, details: unknown) => void;

    crashHandler({}, { reason: 'crashed', exitCode: 1 });

    expect(window.destroy).toHaveBeenCalledOnce();
    // The stale reference is gone, so a fresh window can be created.
    manager.createGantryWindow(dashboard(true));
    expect(gantryWindows()).toHaveLength(2);
  });
});

describe('OverlayManager Gantry always on top', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  const focusHandler = (window: FakeBrowserWindow) =>
    window.on.mock.calls.find(
      ([event]) => event === 'focus'
    )?.[1] as () => void;

  it('pins the window on create when the setting is on', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(pinned(true));
    const [window] = gantryWindows();

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 0);
    expect(window.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it('leaves the window unpinned on create when the setting is off', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(pinned(false));
    const [window] = gantryWindows();

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(window.setAlwaysOnTop).not.toHaveBeenCalledWith(
      true,
      expect.anything(),
      expect.anything()
    );
  });

  it('re-applies the setting on a dashboard update without recreating the window', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(pinned(false));
    const [window] = gantryWindows();
    window.setAlwaysOnTop.mockClear();

    manager.syncGantryWindow(pinned(true));
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(
      true,
      'screen-saver',
      0
    );

    manager.syncGantryWindow(pinned(false));
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(false);

    expect(gantryWindows()).toHaveLength(1);
  });

  it('does not re-pin on updates that leave the setting unchanged', () => {
    const manager = new OverlayManager();
    manager.syncGantryWindow(pinned(true));
    const [window] = gantryWindows();
    window.setAlwaysOnTop.mockClear();

    manager.syncGantryWindow(pinned(true));

    expect(window.setAlwaysOnTop).not.toHaveBeenCalled();
  });

  it.each([['true'], [1], [null], [undefined], [{}]])(
    'treats a non-boolean value (%j) as off',
    (value) => {
      const manager = new OverlayManager();
      manager.createGantryWindow(pinned(value));
      const [window] = gantryWindows();

      expect(window.setAlwaysOnTop).toHaveBeenCalledWith(false);
      expect(window.setAlwaysOnTop).toHaveBeenCalledTimes(1);
    }
  );

  it('treats a malformed window block as off', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true, { window: 'yes' }));
    const [window] = gantryWindows();

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(false);
  });

  it('keeps the overlays above a pinned Gantry when it is pinned or focused', () => {
    const manager = new OverlayManager();
    const overlay = new FakeBrowserWindow({ title: 'overlay' });
    (
      manager as unknown as { displayWindows: Map<number, FakeBrowserWindow> }
    ).displayWindows.set(1, overlay);

    manager.syncGantryWindow(pinned(false));
    const [window] = gantryWindows();
    focusHandler(window)();
    expect(overlay.moveTop).not.toHaveBeenCalled();

    manager.syncGantryWindow(pinned(true));
    expect(overlay.moveTop).toHaveBeenCalledOnce();

    focusHandler(window)();
    expect(overlay.moveTop).toHaveBeenCalledTimes(2);
  });
});
