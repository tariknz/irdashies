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

const PRIMARY_DISPLAY = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};
const SECOND_DISPLAY = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};
const screenState = vi.hoisted(() => ({
  displays: [] as { id: number; bounds: Record<string, number> }[],
}));

class FakeWebContents {
  id = 42 + createdWindows.length;
  isDestroyed = vi.fn(() => false);
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
  close = vi.fn();
  setAlwaysOnTop = vi.fn();
  setBounds = vi.fn();
  setPosition = vi.fn();
  setSize = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  setTitleBarOverlay = vi.fn();
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
    setLoginItemSettings: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: FakeBrowserWindow,
  Notification: vi.fn(),
  screen: {
    on: vi.fn(),
    getAllDisplays: () => screenState.displays,
    getPrimaryDisplay: () => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  },
}));

vi.mock('./storage/storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('./storage/dashboards', () => ({
  getDashboard: vi.fn(),
  getCurrentProfileId: vi.fn(() => 'default'),
}));
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
const { app } = await import('electron');
const { getDashboard, getCurrentProfileId } =
  await import('./storage/dashboards');

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

beforeEach(() => {
  screenState.displays = [PRIMARY_DISPLAY];
});

describe('OverlayManager display windows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  it.each([
    ['an overlay widget', undefined, 2],
    ['a Gantry-only widget', 'gantry' as const, 1],
  ])(
    'opens a window for a display holding %s',
    (_label, placement, expectedWindows) => {
      screenState.displays = [PRIMARY_DISPLAY, SECOND_DISPLAY];
      const manager = new OverlayManager();

      manager.ensureDisplayWindows({
        widgets: [
          {
            id: 'fuel-2',
            type: 'fuel',
            enabled: true,
            placement,
            layout: { x: 2000, y: 100, width: 300, height: 200 },
          },
        ],
      } as DashboardLayout);

      expect(createdWindows).toHaveLength(expectedWindows);
    }
  );

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

  it('keeps the rebuilt overlay when the old one reports closed late', () => {
    const manager = new OverlayManager();
    const dashboard = { widgets: [] } as DashboardLayout;
    manager.createOverlays(dashboard, { createSettingsWindow: false });
    const oldWindow = createdWindows[0];

    manager.forceRefreshOverlays(dashboard, { createSettingsWindow: false });
    const newWindow = createdWindows[1];
    // win.close() is async, so 'closed' arrives after the new window exists
    const closedHandler = oldWindow.on.mock.calls.find(
      ([event]) => event === 'closed'
    )?.[1] as () => void;
    closedHandler();

    expect(manager.getOverlays().map((o) => o.window)).toEqual([newWindow]);
  });
});

describe('individual overlay windows', () => {
  const widget = (id: string, x: number) => ({
    id,
    type: 'flag',
    enabled: true,
    layout: { x, y: 100, width: 300, height: 200 },
  });
  const dashboard = (): DashboardLayout => ({
    widgets: [widget('flag-left', 100), widget('flag-right', 1800)],
    generalSettings: { overlayWindowMode: 'widget' },
  });
  const ready = (win: FakeBrowserWindow) => {
    const handler = win.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;
    handler();
    const loaded = win.webContents.on.mock.calls.find(
      ([event]) => event === 'did-finish-load'
    )?.[1] as () => void;
    loaded();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
    screenState.displays = [PRIMARY_DISPLAY, SECOND_DISPLAY];
  });

  it('creates one window per enabled instance and preserves a cross-display span', () => {
    const manager = new OverlayManager();
    const layout = dashboard();
    layout.widgets.push(
      { ...widget('disabled', 100), enabled: false },
      { ...widget('docked', 100), placement: 'gantry' },
      { ...widget('gantry', 100), type: 'gantry', enabled: false }
    );
    manager.createOverlays(layout, { createSettingsWindow: false });
    expect(manager.getOverlays()).toHaveLength(2);
    expect(createdWindows[1].options).toMatchObject({
      x: 1780,
      y: 80,
      width: 340,
      height: 240,
    });
    expect(createdWindows[1].loadFile).toHaveBeenCalledWith(
      expect.any(String),
      { hash: '/overlay-widget' }
    );
    ready(createdWindows[1]);
    expect(createdWindows[1].webContents.send).toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.objectContaining({
        widgetId: 'flag-right',
        widgetLayout: layout.widgets[1].layout,
        expected: { x: 1780, y: 80, width: 340, height: 240 },
      })
    );
  });

  it('switches immediately in both directions and defaults unknown saved modes to display', () => {
    const manager = new OverlayManager();
    const layout = dashboard();
    manager.createOverlays(
      { ...layout, generalSettings: { overlayWindowMode: 'unknown' as never } },
      { createSettingsWindow: false }
    );
    expect(manager.getOverlays()).toHaveLength(2);
    const original = [...createdWindows];
    manager.ensureDisplayWindows(layout);
    expect(original.every((win) => win.close.mock.calls.length === 1)).toBe(
      true
    );
    expect(manager.getOverlays()).toHaveLength(2);
    expect(
      createdWindows.slice(2).every((win) => win.options.width === 340)
    ).toBe(true);
    manager.ensureDisplayWindows({
      ...layout,
      generalSettings: { overlayWindowMode: 'display' },
    });
    expect(manager.getOverlays()).toHaveLength(2);
    expect(createdWindows.at(-1)?.options.width).toBe(1920);
  });

  it('removes disabled windows and updates retained windows without recreating them', () => {
    const manager = new OverlayManager();
    const layout = dashboard();
    manager.createOverlays(layout, { createSettingsWindow: false });
    ready(createdWindows[0]);
    const next = {
      ...layout,
      widgets: [
        {
          ...layout.widgets[0],
          layout: { x: 300, y: 200, width: 400, height: 250 },
        },
      ],
    };
    manager.ensureDisplayWindows(next);
    expect(createdWindows).toHaveLength(2);
    expect(createdWindows[1].close).toHaveBeenCalledOnce();
    expect(manager.getOverlays()).toHaveLength(1);
    expect(createdWindows[0].setBounds).toHaveBeenLastCalledWith({
      x: 280,
      y: 180,
      width: 440,
      height: 290,
    });
    manager.ensureDisplayWindows({ ...layout, widgets: [] });
    expect(manager.getOverlays()).toHaveLength(0);
  });

  it('seeds each renderer with only its own widget assignment', () => {
    const manager = new OverlayManager();
    manager.createOverlays(dashboard(), { createSettingsWindow: false });
    createdWindows.forEach(ready);
    const second = createdWindows[1];
    second.webContents.send.mockClear();
    manager.sendOverlayState(
      second.webContents as unknown as Electron.WebContents
    );
    expect(second.webContents.send).toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.objectContaining({ widgetId: 'flag-right' })
    );
    expect(second.webContents.send).not.toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.objectContaining({ widgetId: 'flag-left' })
    );
  });

  it('keeps individual window geometry for an empty-renderer benchmark', () => {
    const manager = new OverlayManager();
    const layout = dashboard();
    manager.setWindowLayoutOverride(layout);
    manager.createOverlays(layout, { createSettingsWindow: false });
    manager.ensureDisplayWindows({
      ...layout,
      widgets: layout.widgets.map((w) => ({ ...w, enabled: false })),
    });
    expect(manager.getOverlays()).toHaveLength(2);
    expect(createdWindows).toHaveLength(2);
    expect(
      createdWindows.every((win) => win.close.mock.calls.length === 0)
    ).toBe(true);
  });

  it('ignores late readiness from a replaced window', () => {
    const manager = new OverlayManager();
    const layout = dashboard();
    manager.createOverlays(layout, { createSettingsWindow: false });
    const old = createdWindows[0];
    manager.forceRefreshOverlays(layout, { createSettingsWindow: false });
    ready(old);
    expect(old.showInactive).not.toHaveBeenCalled();
    expect(old.webContents.send).not.toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.anything()
    );
  });

  it('uses shared display windows for editing and seeds rebuilt renderers with edit state', () => {
    const manager = new OverlayManager();
    manager.createOverlays(dashboard(), { createSettingsWindow: false });
    expect(manager.toggleLockOverlays()).toBe(false);
    const editWindows = createdWindows.slice(2);
    expect(editWindows).toHaveLength(2);
    expect(editWindows.every((win) => win.options.width === 1920)).toBe(true);
    manager.sendOverlayState(
      editWindows[0].webContents as unknown as Electron.WebContents
    );
    expect(editWindows[0].webContents.send).toHaveBeenCalledWith(
      'editModeToggled',
      true
    );
    expect(manager.toggleLockOverlays()).toBe(true);
    expect(
      createdWindows.slice(4).every((win) => win.options.width === 340)
    ).toBe(true);
  });

  it('temporarily recovers an unplugged monitor without overwriting the saved layout', () => {
    screenState.displays = [PRIMARY_DISPLAY];
    const manager = new OverlayManager();
    const layout = { ...dashboard(), widgets: [widget('flag-right', 2200)] };
    manager.createOverlays(layout, { createSettingsWindow: false });
    ready(createdWindows[0]);
    expect(createdWindows[0].options.x).toBe(260);
    expect(layout.widgets[0].layout.x).toBe(2200);
    expect(createdWindows[0].webContents.send).toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.objectContaining({
        widgetLayout: { x: 280, y: 100, width: 300, height: 200 },
      })
    );
  });

  it('does not resurrect a crashed widget after a topology change', () => {
    vi.useFakeTimers();
    try {
      const manager = new OverlayManager();
      const layout = dashboard();
      manager.createOverlays(layout, { createSettingsWindow: false });
      const crash = createdWindows[0].webContents.on.mock.calls.find(
        ([event]) => event === 'render-process-gone'
      )?.[1] as (event: unknown, details: unknown) => void;
      crash(null, { reason: 'crashed', exitCode: 1 });
      manager.ensureDisplayWindows({
        ...layout,
        generalSettings: { overlayWindowMode: 'display' },
      });
      const count = createdWindows.length;
      vi.advanceTimersByTime(1000);
      expect(createdWindows).toHaveLength(count);
      expect(manager.getOverlays()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('settings window title bar theme', () => {
  const setup = () => {
    const manager = new OverlayManager();
    const win = new FakeBrowserWindow({});
    (
      manager as unknown as { currentSettingsWindow: FakeBrowserWindow }
    ).currentSettingsWindow = win;
    return { manager, win };
  };

  it.skipIf(process.platform === 'darwin')(
    'retries the repaint after a failed one',
    () => {
      const { manager, win } = setup();
      win.setTitleBarOverlay.mockImplementationOnce(() => {
        throw new Error('gone');
      });

      expect(() => manager.setSettingsTitleBarTheme('carbon')).toThrow();
      manager.setSettingsTitleBarTheme('carbon');
      expect(win.setTitleBarOverlay).toHaveBeenCalledTimes(2);
    }
  );

  it.skipIf(process.platform === 'darwin')(
    'repaints only when the resolved theme changes',
    () => {
      const { manager, win } = setup();

      manager.setSettingsTitleBarTheme('carbon');
      manager.setSettingsTitleBarTheme('carbon');
      expect(win.setTitleBarOverlay).toHaveBeenCalledTimes(1);
      expect(win.setTitleBarOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({ color: '#17181b' })
      );

      // An unknown stored value resolves to Classic, once.
      manager.setSettingsTitleBarTheme('nonsense' as never);
      manager.setSettingsTitleBarTheme(undefined);
      expect(win.setTitleBarOverlay).toHaveBeenCalledTimes(2);
      expect(win.setTitleBarOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({ color: '#314158' })
      );
    }
  );

  it('does nothing without a settings window', () => {
    expect(() =>
      new OverlayManager().setSettingsTitleBarTheme('red')
    ).not.toThrow();
  });
});

describe('settings that are read outside a dashboard update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWindows.length = 0;
  });

  /**
   * The reported bug: autostart is off in the profile the user is on, on in
   * 'default'. Reading 'default' at startup re-created the Windows Run entry
   * every launch, while the settings screen kept showing it as off.
   */
  const profiles: Record<string, DashboardLayout> = {
    default: {
      widgets: [],
      generalSettings: {
        enableAutoStart: true,
        disableHardwareAcceleration: true,
      },
    } as DashboardLayout,
    GT3: {
      widgets: [],
      generalSettings: {
        enableAutoStart: false,
        disableHardwareAcceleration: false,
      },
    } as DashboardLayout,
  };

  const onProfile = (profileId: string) => {
    vi.mocked(getCurrentProfileId).mockReturnValue(profileId);
    vi.mocked(getDashboard).mockImplementation((id: string) => profiles[id]);
  };

  it('does not enable autostart from another profile', () => {
    onProfile('GT3');

    new OverlayManager().setupAutoStart();

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
    });
  });

  it('enables autostart when the active profile asks for it', () => {
    onProfile('default');

    new OverlayManager().setupAutoStart();

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
    });
  });

  it('leaves autostart off when the profile does not mention it', () => {
    // An absent setting must not opt the user into starting with Windows.
    vi.mocked(getCurrentProfileId).mockReturnValue('bare');
    vi.mocked(getDashboard).mockReturnValue({
      widgets: [],
      generalSettings: {},
    } as DashboardLayout);

    new OverlayManager().setupAutoStart();

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
    });
  });

  it('reads the active profile, not the one named default', () => {
    onProfile('GT3');

    new OverlayManager().setupAutoStart();

    expect(getDashboard).toHaveBeenCalledWith('GT3');
    expect(getDashboard).not.toHaveBeenCalledWith('default');
  });

  it('takes hardware acceleration from the active profile too', () => {
    onProfile('GT3');

    new OverlayManager().setupHardwareAcceleration();

    expect(app.disableHardwareAcceleration).not.toHaveBeenCalled();
  });

  it('disables hardware acceleration when the active profile asks for it', () => {
    onProfile('default');

    new OverlayManager().setupHardwareAcceleration();

    expect(app.disableHardwareAcceleration).toHaveBeenCalled();
  });
});
