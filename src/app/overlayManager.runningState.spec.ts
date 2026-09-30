import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  setWindowOpenHandler = vi.fn();
  private handlers = new Map<string, (() => void)[]>();
  on = vi.fn((event: string, handler: () => void) => {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  });
  /** Fires what Electron would fire once the window's page has loaded. */
  emit(event: string) {
    this.handlers.get(event)?.forEach((handler) => handler());
  }
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
  show = vi.fn(() => {
    this.shown = true;
  });
  focus = vi.fn();
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
  setPosition = vi.fn();
  setSize = vi.fn();
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 800, height: 700 }));
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
vi.mock('./storage/simWidgetSupport', () => ({
  getSimWidgetSupport: () => ({
    message: 'This widget is not compatible with the running sim',
    disabledWidgets: { iracing: [], lmu: [] },
  }),
}));
vi.mock('./windowBounds', () => ({
  loadWindowBounds: vi.fn(() => undefined),
  ensureWindowOnScreen: vi.fn(),
}));
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { OverlayManager } = await import('./overlayManager');

const settingsWindow = () =>
  createdWindows.find((w) => w.options.title === 'irDashies - Settings');

const runningStateSends = (window: FakeBrowserWindow) =>
  window.webContents.send.mock.calls.filter(([key]) => key === 'runningState');

describe('OverlayManager running state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  it('forwards the running state to the settings window', () => {
    // The settings header names the simulator feeding telemetry, so it has to
    // hear when one stops. This message used to be withheld as overlay-only.
    const manager = new OverlayManager();
    manager.createSettingsWindow();
    const window = settingsWindow();
    if (!window) throw new Error('no settings window was created');
    window.webContents.send.mockClear();

    manager.publishMessage('runningState', true);

    expect(runningStateSends(window)).toEqual([['runningState', true]]);
  });

  it('still withholds the telemetry inspector stream', () => {
    const manager = new OverlayManager();
    manager.createSettingsWindow();
    const window = settingsWindow();
    if (!window) throw new Error('no settings window was created');
    window.webContents.send.mockClear();

    manager.publishMessage('telemetryInspector:telemetry', {});

    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it('replays the current running state to a window opened mid-session', () => {
    // Bridges publish only on a change, so a window opened after the sim
    // connected would never hear one and would claim nothing is running.
    const manager = new OverlayManager();
    manager.publishMessage('runningState', true);

    manager.createSettingsWindow();
    const window = settingsWindow();
    if (!window) throw new Error('no settings window was created');
    window.webContents.emit('did-finish-load');

    expect(runningStateSends(window)).toEqual([['runningState', true]]);
  });

  it('replays the disconnected state when nothing is running', () => {
    const manager = new OverlayManager();
    manager.publishMessage('runningState', true);
    manager.publishMessage('runningState', false);

    manager.createSettingsWindow();
    const window = settingsWindow();
    if (!window) throw new Error('no settings window was created');
    window.webContents.emit('did-finish-load');

    expect(runningStateSends(window)).toEqual([['runningState', false]]);
  });
});
