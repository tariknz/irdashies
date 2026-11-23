import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  maximize = vi.fn();
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

const electronScreen = vi.hoisted(() => ({
  getAllDisplays: vi.fn((): { workArea: unknown }[] => []),
  getPrimaryDisplay: vi.fn(
    (): { id: number; bounds: unknown; workArea?: unknown } => ({
      id: 1,
      bounds: {},
    })
  ),
}));

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    getPath: () => '/tmp/irdashies-test',
    disableHardwareAcceleration: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    quit: vi.fn(),
  },
  BrowserWindow: FakeBrowserWindow,
  Notification: vi.fn(),
  screen: electronScreen,
}));

vi.mock('./storage/storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('./storage/dashboards', () => ({
  getDashboard: vi.fn(),
  getCurrentProfileId: vi.fn(() => 'profile-1'),
  saveDashboard: vi.fn(),
}));
vi.mock('./storage/chromiumFlags', () => ({
  getChromiumFlags: vi.fn(() => ({})),
  parseCustomSwitches: vi.fn(() => []),
}));
vi.mock('./trackWindowMovement', () => ({
  flushWindowMovementOnShutdown: vi.fn(),
  markCorrectedBounds: vi.fn(),
  trackSettingsWindowMovement: vi.fn(),
  trackGantryWindowMovement: vi.fn(),
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
const {
  flushWindowMovementOnShutdown,
  markCorrectedBounds,
  trackGantryWindowMovement,
} = await import('./trackWindowMovement');
const { getDashboard, saveDashboard } = await import('./storage/dashboards');

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

  it('forwards session data while hidden, but only once subscribed', () => {
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

    // Still hidden: the Gantry has to keep the session while off screen.
    subscriptions.has.mockReturnValue(true);
    manager.publishMessage('sessionData', { revision: 2 });
    expect(window.webContents.send).toHaveBeenCalledWith('sessionData', {
      revision: 2,
    });
    expect(subscriptions.has).toHaveBeenCalledWith(42, 'sessionData');
  });

  it('forwards inspector telemetry only while visible', () => {
    const manager = new OverlayManager();
    manager.setRendererDataSubscriptions({
      has: vi.fn(() => true),
      hasAny: vi.fn(() => true),
    });
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    manager.publishMessage('telemetryInspector:telemetry', { tick: 1 });
    expect(window.webContents.send).not.toHaveBeenCalled();

    window.shown = true;
    manager.publishMessage('telemetryInspector:telemetry', { tick: 2 });
    expect(window.webContents.send).toHaveBeenCalledWith(
      'telemetryInspector:telemetry',
      { tick: 2 }
    );
  });

  it('identifies only its own renderer as the Gantry', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const other = new FakeWebContents();
    other.id = 7;

    expect(
      manager.isGantryWebContents(
        window.webContents as unknown as Electron.WebContents
      )
    ).toBe(true);
    expect(
      manager.isGantryWebContents(other as unknown as Electron.WebContents)
    ).toBe(false);

    window.destroyed = true;
    expect(
      manager.isGantryWebContents(
        window.webContents as unknown as Electron.WebContents
      )
    ).toBe(false);
  });

  it('hides instead of closing while the widget is enabled', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const closeHandler = window.on.mock.calls.find(
      ([event]) => event === 'close'
    )?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };

    closeHandler(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'quitting',
      (manager: InstanceType<typeof OverlayManager>) => manager.markQuitting(),
    ],
    [
      'the Windows session ends',
      (
        _manager: InstanceType<typeof OverlayManager>,
        window: FakeBrowserWindow
      ) =>
        (
          window.on.mock.calls.find(
            ([event]) => event === 'session-end'
          )?.[1] as () => void
        )(),
    ],
  ])('lets the window close when %s', (_label, prepare) => {
    const manager = new OverlayManager();
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();
    const closeHandler = window.on.mock.calls.find(
      ([event]) => event === 'close'
    )?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };

    prepare(manager, window);
    closeHandler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(window.hide).not.toHaveBeenCalled();
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

  it('seeds the cached session to a visible subscribed window', () => {
    const manager = new OverlayManager();
    const subscriptions = {
      has: vi.fn(() => true),
      hasAny: vi.fn(() => false),
    };
    manager.setRendererDataSubscriptions(subscriptions);
    manager.publishMessage('sessionData', { revision: 1 });
    const overlay = new FakeBrowserWindow({ title: 'overlay' });
    overlay.webContents.id = 7;
    const overlaySender =
      overlay.webContents as unknown as Electron.WebContents;

    // Hidden: nothing is sent.
    expect(manager.seedSessionData(overlaySender)).toBe(false);
    expect(overlay.webContents.send).not.toHaveBeenCalled();

    overlay.shown = true;
    expect(manager.seedSessionData(overlaySender)).toBe(true);
    expect(overlay.webContents.send).toHaveBeenCalledWith('sessionData', {
      revision: 1,
    });
  });

  it('seeds the cached session to the Gantry while it is hidden', () => {
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

  it('targets hidden Gantry session initialization without bypassing subscriptions', () => {
    const manager = new OverlayManager();
    const subscriptions = {
      has: vi.fn(() => true),
      hasAny: vi.fn(() => false),
    };
    manager.setRendererDataSubscriptions(subscriptions);
    manager.createGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    manager.publishMessageToOverlay('gantry', 'sessionData', { revision: 1 });
    expect(window.webContents.send).toHaveBeenCalledWith('sessionData', {
      revision: 1,
    });

    window.webContents.send.mockClear();
    subscriptions.has.mockReturnValue(false);
    manager.publishMessageToOverlay('gantry', 'sessionData', { revision: 2 });
    expect(window.webContents.send).not.toHaveBeenCalled();
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

describe('OverlayManager Gantry window placement', () => {
  const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 };
  const SECOND = { x: 1920, y: 0, width: 2560, height: 1400 };
  const SAVED = { x: 2100, y: 150, width: 1300, height: 760 };

  const connect = (...workAreas: (typeof PRIMARY)[]) => {
    electronScreen.getAllDisplays.mockReturnValue(
      workAreas.map((workArea) => ({ workArea }))
    );
    electronScreen.getPrimaryDisplay.mockReturnValue({
      id: 1,
      bounds: workAreas[0],
      workArea: workAreas[0],
    });
  };

  const placed = (window: Record<string, unknown>) =>
    dashboard(true, { window: { alwaysOnTop: false, ...window } });

  const readyToShow = (window: FakeBrowserWindow) =>
    window.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  afterEach(() => {
    electronScreen.getAllDisplays.mockImplementation(() => []);
    electronScreen.getPrimaryDisplay.mockImplementation(() => ({
      id: 1,
      bounds: {},
    }));
  });

  it('reopens where it was last placed', () => {
    connect(PRIMARY, SECOND);
    new OverlayManager().createGantryWindow(placed({ bounds: SAVED }));
    const [window] = gantryWindows();

    expect(window.options).toMatchObject(SAVED);
  });

  it('opens at the default size when nothing has been saved', () => {
    connect(PRIMARY, SECOND);
    new OverlayManager().createGantryWindow(dashboard(true));
    const [window] = gantryWindows();

    expect(window.options).toMatchObject({ width: 1400, height: 800 });
    expect(window.options.x).toBeUndefined();
  });

  it('brings a window saved on a disconnected monitor back onto the primary display', () => {
    connect(PRIMARY);
    new OverlayManager().createGantryWindow(placed({ bounds: SAVED }));
    const [window] = gantryWindows();
    const { x, y, width, height } = window.options as typeof SAVED;

    expect(x).toBeGreaterThanOrEqual(PRIMARY.x);
    expect(y).toBeGreaterThanOrEqual(PRIMARY.y);
    expect(x + width).toBeLessThanOrEqual(PRIMARY.x + PRIMARY.width);
    expect(y + height).toBeLessThanOrEqual(PRIMARY.y + PRIMARY.height);
  });

  it('does not save the rescued position over the one on the missing monitor', () => {
    connect(PRIMARY);
    new OverlayManager().createGantryWindow(
      placed({ bounds: SAVED, maximized: true })
    );
    const [window] = gantryWindows();

    expect(markCorrectedBounds).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        x: window.options.x,
        y: window.options.y,
        width: window.options.width,
        height: window.options.height,
      })
    );
  });

  it('marks nothing as corrected when the saved position is still on screen', () => {
    connect(PRIMARY, SECOND);
    new OverlayManager().createGantryWindow(placed({ bounds: SAVED }));

    expect(markCorrectedBounds).not.toHaveBeenCalled();
  });

  it('saves a pending move before quitting destroys the window', () => {
    const manager = new OverlayManager();
    manager.createGantryWindow(placed({ bounds: SAVED }));
    const [window] = gantryWindows();

    manager.quitApp();

    expect(flushWindowMovementOnShutdown).toHaveBeenCalledOnce();
    expect(
      vi.mocked(flushWindowMovementOnShutdown).mock.invocationCallOrder[0]
    ).toBeLessThan(window.destroy.mock.invocationCallOrder[0]);
  });

  it('reopens maximised when it was left maximised', () => {
    connect(PRIMARY, SECOND);
    new OverlayManager().createGantryWindow(
      placed({ bounds: SAVED, maximized: true })
    );
    const [window] = gantryWindows();
    readyToShow(window)();

    expect(window.maximize).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
  });

  it('saves a move to the active profile', () => {
    const current = placed({ bounds: SAVED });
    vi.mocked(getDashboard).mockReturnValue(current);
    new OverlayManager().createGantryWindow(current);
    const save = vi.mocked(trackGantryWindowMovement).mock.calls[0][1];

    save({ bounds: { ...SAVED, x: 300 }, maximized: false });

    expect(getDashboard).toHaveBeenCalledWith('profile-1');
    const [profileId, updated] = vi.mocked(saveDashboard).mock.calls[0];
    expect(profileId).toBe('profile-1');
    expect(updated.widgets[0].config).toMatchObject({
      window: { bounds: { ...SAVED, x: 300 }, maximized: false },
    });
  });

  it('does not save when the window ends up where it already was', () => {
    const current = placed({ bounds: SAVED, maximized: false });
    vi.mocked(getDashboard).mockReturnValue(current);
    new OverlayManager().createGantryWindow(current);
    const save = vi.mocked(trackGantryWindowMovement).mock.calls[0][1];

    save({ bounds: SAVED, maximized: false });

    expect(saveDashboard).not.toHaveBeenCalled();
  });
});
