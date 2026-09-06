import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import {
  refreshSessionDataForVisibleWindow,
  type RendererDataSubscriptions,
} from './rendererDataVisibility';

vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', undefined);
vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
vi.stubGlobal('APP_GIT_HASH', 'test');
if (!process.resourcesPath) {
  Object.defineProperty(process, 'resourcesPath', { value: '/resources' });
}

const createdWindows: FakeBrowserWindow[] = [];

class FakeWebContents {
  id = 42;
  on = vi.fn();
  send = vi.fn();
  setWindowOpenHandler = vi.fn();
}

class FakeBrowserWindow {
  static getAllWindows = vi.fn(() => []);
  webContents = new FakeWebContents();
  shown = false;
  show = vi.fn(() => {
    this.shown = true;
  });
  showInactive = vi.fn(() => {
    this.shown = true;
  });
  focus = vi.fn();
  setAlwaysOnTop = vi.fn();
  setBounds = vi.fn();
  setPosition = vi.fn();
  setSize = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  setVisibleOnAllWorkspaces = vi.fn();
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }));
  loadFile = vi.fn();
  loadURL = vi.fn();
  on = vi.fn();
  once = vi.fn();
  isDestroyed = vi.fn(() => false);
  isVisible = vi.fn(() => this.shown);

  constructor(public options: Record<string, unknown>) {
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
    getAllDisplays: () => [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ],
    getPrimaryDisplay: () => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  },
}));

vi.mock('./storage/storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('./storage/dashboards', () => ({ getDashboard: vi.fn() }));
vi.mock('./storage/chromiumFlags', () => ({
  getChromiumFlags: vi.fn(() => ({})),
  parseCustomSwitches: vi.fn(() => []),
}));
vi.mock('./trackWindowMovement', () => ({
  markCorrectedBounds: vi.fn(),
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

describe('overlay renderer data visibility recovery', () => {
  it('replays the latest session snapshot when a subscribed window is shown', () => {
    const send = vi.fn();
    let visible = false;
    const win = {
      isDestroyed: () => false,
      isVisible: () => visible,
      webContents: { id: 42, send },
    };
    const subscriptions: RendererDataSubscriptions = {
      has: (rendererId, stream) =>
        rendererId === 42 && stream === 'sessionData',
      hasAny: () => true,
    };
    const snapshot = { WeekendInfo: { TrackName: 'Test Track' } };

    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, snapshot)
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();

    visible = true;
    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, snapshot)
    ).toBe(true);
    expect(send).toHaveBeenCalledWith('sessionData', snapshot);
  });

  it('does not replay session data without an active subscription', () => {
    const send = vi.fn();
    const win = {
      isDestroyed: () => false,
      isVisible: () => true,
      webContents: { id: 42, send },
    };
    const subscriptions: RendererDataSubscriptions = {
      has: () => false,
      hasAny: () => false,
    };

    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, { value: 1 })
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('OverlayManager display windows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  it.each([true, false])(
    'creates overlays with alwaysOnTop=%s when configured',
    (overlayAlwaysOnTop) => {
      const manager = new OverlayManager();
      const dashboard = {
        widgets: [],
        generalSettings: { overlayAlwaysOnTop },
      } as DashboardLayout;

      manager.createOverlays(dashboard, { createSettingsWindow: false });

      expect(createdWindows).toHaveLength(1);
      expect(createdWindows[0].options.alwaysOnTop).toBe(overlayAlwaysOnTop);
    }
  );

  it('puts an always-on-top overlay in the same band as the settings window', () => {
    // The constructor flag alone is not enough. toggleLockOverlays raises the
    // settings window to 'screen-saver' 2 during edit mode so it sits above the
    // overlays, which only works if the overlays are at 'screen-saver' 1. With
    // the level left off, the settings window and a fullscreen sim both end up
    // above the overlays instead, and the widgets vanish.
    const manager = new OverlayManager();

    manager.createOverlays(
      {
        widgets: [],
        generalSettings: { overlayAlwaysOnTop: true },
      } as DashboardLayout,
      { createSettingsWindow: false }
    );

    expect(createdWindows[0].setAlwaysOnTop).toHaveBeenCalledWith(
      true,
      'screen-saver',
      1
    );
  });

  it('leaves the level alone when the user has turned always-on-top off', () => {
    const manager = new OverlayManager();

    manager.createOverlays(
      {
        widgets: [],
        generalSettings: { overlayAlwaysOnTop: false },
      } as DashboardLayout,
      { createSettingsWindow: false }
    );

    expect(createdWindows[0].setAlwaysOnTop).not.toHaveBeenCalled();
  });

  it('shows a ready display overlay without activating it', () => {
    const manager = new OverlayManager();
    manager.createOverlays({ widgets: [] } as DashboardLayout, {
      createSettingsWindow: false,
    });
    const displayWindow = createdWindows[0];
    const readyHandler = displayWindow.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;

    readyHandler();

    expect(displayWindow.showInactive).toHaveBeenCalledOnce();
    expect(displayWindow.show).not.toHaveBeenCalled();
    expect(displayWindow.focus).not.toHaveBeenCalled();
  });
});
