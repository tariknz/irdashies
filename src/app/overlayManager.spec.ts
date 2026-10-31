import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { PROFILE_SWITCH_BANNER_MS } from '@irdashies/types';
import { getHiddenWidgets, toggleWidgetHidden } from './widgetVisibility';
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
  on: vi.fn(),
}));

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
  close = vi.fn();
  hide = vi.fn();
  setAlwaysOnTop = vi.fn();
  bounds = { x: 0, y: 0, width: 1920, height: 1080 };
  setBounds = vi.fn((bounds: Electron.Rectangle) => {
    this.bounds = { ...bounds };
  });
  setPosition = vi.fn((x: number, y: number) => {
    this.bounds = { ...this.bounds, x, y };
  });
  setSize = vi.fn((width: number, height: number) => {
    this.bounds = { ...this.bounds, width, height };
  });
  setShape = vi.fn();
  setIgnoreMouseEvents = vi.fn();
  setTitleBarOverlay = vi.fn();
  setVisibleOnAllWorkspaces = vi.fn();
  getBounds = vi.fn(() => ({ ...this.bounds }));
  loadFile = vi.fn();
  loadURL = vi.fn();
  on = vi.fn();
  once = vi.fn();
  isDestroyed = vi.fn(() => false);
  isVisible = vi.fn(() => this.shown);

  constructor(public options: Record<string, unknown>) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (typeof options[key] === 'number') this.bounds[key] = options[key];
    }
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
    on: screenState.on,
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

describe('overlay window regions', () => {
  const originalPlatform = process.platform;
  const dashboard = (): DashboardLayout =>
    ({
      widgets: [
        {
          id: 'standings',
          enabled: true,
          layout: { x: 100, y: 100, width: 100, height: 100 },
        },
        {
          id: 'fuel',
          enabled: true,
          layout: { x: 1000, y: 500, width: 100, height: 100 },
        },
      ],
    }) as DashboardLayout;

  const load = (window: FakeBrowserWindow) => {
    const ready = window.once.mock.calls.find(
      ([event]) => event === 'ready-to-show'
    )?.[1] as () => void;
    const loaded = window.webContents.on.mock.calls.find(
      ([event]) => event === 'did-finish-load'
    )?.[1] as () => void;
    ready();
    loaded();
  };

  const start = (layout = dashboard()) => {
    const manager = new OverlayManager();
    manager.createOverlays(layout, { createSettingsWindow: false });
    const window = createdWindows[0];
    load(window);
    return { manager, window };
  };

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdWindows.length = 0;
    getHiddenWidgets().forEach(toggleWidgetHidden);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    getHiddenWidgets().forEach(toggleWidgetHidden);
  });

  it('pads each widget independently and waits for renderer bounds before applying', () => {
    const manager = new OverlayManager();
    manager.createOverlays(dashboard(), { createSettingsWindow: false });
    const window = createdWindows[0];
    manager.updateOverlayBounds();
    expect(window.setShape).not.toHaveBeenCalled();
    load(window);
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
  });

  it('updates an interior widget region even when the outer bounds stay identical', () => {
    const layout = dashboard();
    layout.widgets.push({
      id: 'input',
      enabled: true,
      layout: { x: 400, y: 300, width: 100, height: 100 },
    });
    const { manager, window } = start(layout);
    window.setBounds.mockClear();
    window.setShape.mockClear();
    layout.widgets[2].layout.x = 500;
    manager.updateOverlayBounds(layout);
    expect(window.setBounds).not.toHaveBeenCalled();
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 400, y: 200, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
    manager.updateOverlayBounds();
    expect(window.setShape).toHaveBeenCalledOnce();
  });

  it('restores the full edit surface on unlock and reapplies clipping on lock', () => {
    const { manager, window } = start();
    manager.toggleLockOverlays();
    expect(window.setShape).toHaveBeenLastCalledWith([]);
    expect(window.bounds).toEqual(PRIMARY_DISPLAY.bounds);
    manager.toggleLockOverlays();
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
  });

  it('uses the same expected origin as the renderer when Windows constrains positioning', () => {
    const { manager, window } = start();
    window.setBounds.mockImplementation((bounds) => {
      window.bounds = { ...bounds, x: bounds.x + 5, y: bounds.y + 8 };
    });
    manager.toggleLockOverlays();
    manager.toggleLockOverlays();
    expect(manager.getContainerBoundsInfo()?.actual.x).toBe(85);
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
  });

  it('removes hotkey-hidden regions without hiding the recorder host when all are hidden', () => {
    const { manager, window } = start();
    toggleWidgetHidden('standings');
    manager.updateOverlayBounds();
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
    toggleWidgetHidden('fuel');
    manager.updateOverlayBounds();
    expect(window.setShape).toHaveBeenLastCalledWith([]);
    expect(window.shown).toBe(true);
    expect(window.hide).not.toHaveBeenCalled();
    toggleWidgetHidden('standings');
    manager.updateOverlayBounds();
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
    ]);
  });

  it('resyncs renderer coordinates when a new target catches up with a constrained actual origin', () => {
    const layout = dashboard();
    const { manager, window } = start(layout);
    window.setBounds.mockImplementation((bounds) => {
      window.bounds = { ...bounds, x: bounds.x + 80 };
    });
    manager.toggleLockOverlays();
    manager.toggleLockOverlays();
    expect(manager.getContainerBoundsInfo()?.expected.x).toBe(80);
    expect(window.bounds.x).toBe(160);

    layout.widgets.forEach((widget) => {
      widget.layout.x += 80;
    });
    window.setBounds.mockClear();
    window.webContents.send.mockClear();
    manager.updateOverlayBounds(layout);

    expect(window.setBounds).not.toHaveBeenCalled();
    expect(manager.getContainerBoundsInfo()?.expected.x).toBe(160);
    expect(manager.getContainerBoundsInfo()?.offset.x).toBe(0);
    expect(window.webContents.send).toHaveBeenCalledWith(
      'containerBoundsInfo',
      expect.objectContaining({ expected: expect.objectContaining({ x: 160 }) })
    );
  });

  it('does not include Gantry windows or Gantry-only placements in the region', () => {
    const layout = dashboard();
    layout.widgets.push(
      {
        id: 'gantry',
        enabled: true,
        layout: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'fuel-2',
        type: 'fuel',
        placement: 'gantry',
        enabled: true,
        layout: { x: 400, y: 300, width: 300, height: 200 },
      }
    );
    const { window } = start(layout);
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
  });

  it('leaves out widgets unsupported by the active simulator', () => {
    const manager = new OverlayManager();
    manager.setActiveSimulator('lmu');
    manager.createOverlays(dashboard(), { createSettingsWindow: false });
    const window = createdWindows[0];
    load(window);
    // Fuel is not supported by LMU; Standings is.
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
    ]);
  });

  it('keeps masks local to a negative-origin display without applying widget scale twice', () => {
    screenState.displays = [
      PRIMARY_DISPLAY,
      { id: 2, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } },
    ];
    const layout = dashboard();
    layout.widgets.push({
      id: 'input',
      enabled: true,
      scale: 200,
      layout: { x: -1800, y: 100, width: 100, height: 100 },
    });
    const { window: primary } = start(layout);
    const secondary = createdWindows[1];
    load(secondary);
    expect(primary.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
      { x: 900, y: 400, width: 140, height: 140 },
    ]);
    expect(secondary.bounds.x).toBe(-1820);
    expect(secondary.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
    ]);
  });

  it('clips the disconnected-display fallback where the renderer will put it', () => {
    const layout = dashboard();
    layout.widgets = [layout.widgets[0]];
    layout.widgets[0].layout.x = 4000;
    const { window } = start(layout);
    expect(window.bounds.x).toBe(140);
    expect(window.setShape).toHaveBeenLastCalledWith([
      { x: 0, y: 0, width: 140, height: 140 },
    ]);
    expect(layout.widgets[0].layout.x).toBe(4000);
  });

  it('clears clipping for a profile transition until the banner has finished', () => {
    const { manager, window } = start();
    manager.publishMessage('profileTransition', { hidden: true, name: 'Race' });
    expect(window.setShape).toHaveBeenLastCalledWith([]);
    manager.publishMessage('profileTransition', {
      hidden: false,
      name: 'Race',
    });
    vi.advanceTimersByTime(PROFILE_SWITCH_BANNER_MS);
    expect(window.setShape).toHaveBeenLastCalledWith([]);
    vi.advanceTimersByTime(250);
    expect(window.setShape).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ x: 0, y: 0, width: 140, height: 140 }])
    );
  });

  it('cancels a prior restore during rapid switches and restores immediately without a banner', () => {
    const { manager, window } = start();
    manager.publishMessage('profileTransition', {
      hidden: false,
      name: 'Race',
    });
    vi.advanceTimersByTime(1000);
    manager.publishMessage('profileTransition', {
      hidden: true,
      name: 'Practice',
    });
    vi.advanceTimersByTime(2000);
    expect(window.setShape).toHaveBeenLastCalledWith([]);
    manager.publishMessage('profileTransition', {
      hidden: false,
      name: 'Practice',
      showBanner: false,
    });
    expect(window.setShape).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ x: 0, y: 0, width: 140, height: 140 }])
    );
  });

  it('keeps a replacement window unclipped during the profile banner', () => {
    const { manager } = start();
    manager.publishMessage('profileTransition', {
      hidden: false,
      name: 'Race',
    });
    manager.forceRefreshOverlays(dashboard(), { createSettingsWindow: false });
    const replacement = createdWindows[1];
    load(replacement);
    expect(replacement.setShape).toHaveBeenLastCalledWith([]);
    vi.advanceTimersByTime(PROFILE_SWITCH_BANNER_MS + 250);
    expect(replacement.setShape).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ x: 0, y: 0, width: 140, height: 140 }])
    );
  });

  it('recreates regions after a display DPI-only change', () => {
    const { manager } = start();
    // The manager registers its rebuild callback with Electron's screen emitter.
    const changed = screenState.on.mock.calls.find(
      ([event]) => event === 'display-metrics-changed'
    )?.[1] as (...args: unknown[]) => void;
    changed({}, PRIMARY_DISPLAY, ['scaleFactor']);
    vi.advanceTimersByTime(1000);
    const replacement = createdWindows[1];
    load(replacement);
    expect(replacement.setShape).toHaveBeenCalledOnce();
    manager.markQuitting();
  });

  it('cancels banner restoration during quit', () => {
    const { manager } = start();
    manager.publishMessage('profileTransition', {
      hidden: false,
      name: 'Race',
    });
    manager.markQuitting();
    expect(vi.getTimerCount()).toBe(0);
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
