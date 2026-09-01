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
const mockGetAllDisplays = vi.hoisted(() =>
  vi.fn<() => Electron.Display[]>(() => [])
);
const mockGetPrimaryDisplay = vi.hoisted(() =>
  vi.fn(() => ({ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }))
);

class FakeWebContents {
  id = 42;
  send = vi.fn();
  on = vi.fn();
  setWindowOpenHandler = vi.fn();
}

class FakeBrowserWindow {
  static getAllWindows = vi.fn(() => []);
  webContents = new FakeWebContents();
  id = createdWindows.length + 1;
  destroyed = false;
  shown = false;
  focused = false;
  focusable = true;
  show = vi.fn(() => {
    this.shown = true;
  });
  showInactive = vi.fn(() => {
    this.shown = true;
  });
  focus = vi.fn(() => {
    this.focused = true;
  });
  hide = vi.fn(() => {
    this.shown = false;
  });
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
  setPosition = vi.fn();
  setSize = vi.fn();
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }));
  isFocused = vi.fn(() => this.focused);
  isAlwaysOnTop = vi.fn(() => true);
  isFocusable = vi.fn(() => this.focusable);
  setFocusable = vi.fn((focusable: boolean) => {
    this.focusable = focusable;
  });
  setAlwaysOnTop = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  setVisibleOnAllWorkspaces = vi.fn();
  once = vi.fn();
  on = vi.fn();

  constructor(public options: Record<string, unknown>) {
    this.focusable = options.focusable !== false;
    createdWindows.push(this);
  }
}

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    disableHardwareAcceleration: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: FakeBrowserWindow,
  Notification: vi.fn(),
  screen: {
    getAllDisplays: mockGetAllDisplays,
    getPrimaryDisplay: mockGetPrimaryDisplay,
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
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { OverlayManager } = await import('./overlayManager');
const { hardenWindow } = await import('./hardenWindow');

const dashboard = (enabled: boolean) =>
  ({ widgets: [{ id: 'gantry', enabled, config: {} }] }) as DashboardLayout;

const gantryWindows = () =>
  createdWindows.filter((w) => w.options.title === 'irDashies - Gantry');

describe('OverlayManager Gantry window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  it('shows a display overlay inactive when it first becomes ready', () => {
    mockGetAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      } as Electron.Display,
    ]);
    const manager = new OverlayManager();
    manager.createOverlays(dashboard(false), { createSettingsWindow: false });
    const displayWindow = createdWindows.find((window) =>
      String(window.options.title).startsWith('irDashies - 1')
    );
    const readyHandler = displayWindow?.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;

    readyHandler();

    expect(displayWindow?.showInactive).toHaveBeenCalledOnce();
    expect(displayWindow?.show).not.toHaveBeenCalled();
    expect(displayWindow?.focus).not.toHaveBeenCalled();
    expect(displayWindow?.options.focusable).toBe(false);
  });

  it('preserves focusable display overlays on non-Windows platforms', () => {
    mockGetAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      } as Electron.Display,
    ]);
    const manager = new OverlayManager('linux');
    manager.createOverlays(dashboard(false), { createSettingsWindow: false });
    const displayWindow = createdWindows.find((window) =>
      String(window.options.title).startsWith('irDashies - 1')
    );

    expect(displayWindow?.options.focusable).toBe(true);
    manager.toggleLockOverlays();
    expect(displayWindow?.setFocusable).not.toHaveBeenCalled();
    expect(displayWindow?.focus).toHaveBeenCalledOnce();
  });

  it('makes Windows overlays focusable before edit focus and non-focusable when locked', () => {
    mockGetAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      } as Electron.Display,
    ]);
    const manager = new OverlayManager('win32');
    manager.createOverlays(dashboard(false), { createSettingsWindow: false });
    const displayWindow = createdWindows.find((window) =>
      String(window.options.title).startsWith('irDashies - 1')
    );

    manager.toggleLockOverlays();
    expect(displayWindow?.setFocusable).toHaveBeenCalledWith(true);
    expect(
      displayWindow?.setFocusable.mock.invocationCallOrder[0]
    ).toBeLessThan(displayWindow?.focus.mock.invocationCallOrder[0] ?? 0);

    displayWindow?.setFocusable.mockClear();
    displayWindow?.focus.mockClear();
    manager.toggleLockOverlays();
    expect(displayWindow?.setFocusable).toHaveBeenCalledWith(false);
    expect(displayWindow?.focus).not.toHaveBeenCalled();
  });

  it('keeps display windows created during Alt+H hide natively hidden', () => {
    mockGetAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      } as Electron.Display,
    ]);
    const manager = new OverlayManager('win32');
    manager.setDisplayOverlaysHidden(true);
    manager.createOverlays(dashboard(false), { createSettingsWindow: false });
    const displayWindow = createdWindows.find((window) =>
      String(window.options.title).startsWith('irDashies - 1')
    );
    const readyHandler = displayWindow?.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;

    readyHandler();

    expect(displayWindow?.hide).toHaveBeenCalledOnce();
    expect(displayWindow?.showInactive).not.toHaveBeenCalled();
    expect(displayWindow?.show).not.toHaveBeenCalled();
    expect(displayWindow?.focus).not.toHaveBeenCalled();
  });

  it('natively toggles only display overlays and refreshes session data', () => {
    mockGetAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      } as Electron.Display,
    ]);
    const manager = new OverlayManager();
    manager.createOverlays(dashboard(false), { createSettingsWindow: false });
    manager.createGantryWindow(dashboard(true));
    const displayWindow = createdWindows.find((window) =>
      String(window.options.title).startsWith('irDashies - 1')
    );
    const gantryWindow = gantryWindows()[0];
    const readyHandler = displayWindow?.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;
    readyHandler();
    manager.setRendererDataSubscriptions({
      has: () => true,
      hasAny: () => true,
    });
    manager.publishMessage('sessionData', { revision: 1 });
    displayWindow?.webContents.send.mockClear();
    displayWindow?.hide.mockClear();
    displayWindow?.showInactive.mockClear();

    manager.setDisplayOverlaysHidden(true);
    expect(displayWindow?.hide).toHaveBeenCalledOnce();
    expect(gantryWindow.hide).not.toHaveBeenCalled();

    manager.setDisplayOverlaysHidden(false);
    expect(displayWindow?.showInactive).toHaveBeenCalledOnce();
    expect(displayWindow?.show).not.toHaveBeenCalled();
    expect(displayWindow?.focus).not.toHaveBeenCalled();
    expect(displayWindow?.webContents.send).toHaveBeenCalledWith(
      'sessionData',
      { revision: 1 }
    );
    expect(gantryWindow.showInactive).not.toHaveBeenCalled();
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
