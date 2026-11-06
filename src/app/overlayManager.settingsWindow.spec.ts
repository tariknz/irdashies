import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Rect } from './windowBounds';

vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', undefined);
vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
vi.stubGlobal('APP_GIT_HASH', 'test');
if (!process.resourcesPath) {
  Object.defineProperty(process, 'resourcesPath', { value: '/resources' });
}

const state = vi.hoisted(() => ({
  primary: {
    id: 1,
    scaleFactor: 1,
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    workArea: { x: 0, y: 40, width: 2560, height: 1400 },
  },
  store: undefined as
    | ReturnType<
        typeof import('./storage/settingsWindowBounds').createSettingsWindowBoundsStore
      >
    | undefined,
}));
const appEvents = vi.hoisted(() => ({
  on: vi.fn<(event: string, callback: () => void) => void>(),
}));
const currentStore = () => {
  if (!state.store)
    throw new Error('settings bounds fixture is not initialized');
  return state.store;
};
const windows: FakeBrowserWindow[] = [];
class FakeBrowserWindow {
  static getAllWindows = vi.fn(() => []);
  webContents = {
    id: 42,
    on: vi.fn(),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
  };
  on = vi.fn();
  once = vi.fn();
  show = vi.fn();
  focus = vi.fn();
  restore = vi.fn();
  isMinimized = vi.fn(() => false);
  isDestroyed = vi.fn(() => false);
  setAlwaysOnTop = vi.fn();
  loadURL = vi.fn();
  loadFile = vi.fn();
  rectangle: Rect;
  getBounds = vi.fn(() => ({ ...this.rectangle }));
  setBounds = vi.fn((rect: Rect) => {
    this.rectangle = { ...rect };
  });
  constructor(public options: Record<string, unknown>) {
    this.rectangle = {
      x: options.x as number,
      y: options.y as number,
      width: options.width as number,
      height: options.height as number,
    };
    windows.push(this);
  }
  emit(event: string) {
    for (const [name, callback] of [
      ...this.on.mock.calls,
      ...this.once.mock.calls,
    ]) {
      if (name === event) callback();
    }
  }
}
vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    on: appEvents.on,
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: FakeBrowserWindow,
  Notification: vi.fn(),
  screen: {
    getPrimaryDisplay: () => state.primary,
    getAllDisplays: () => [
      { id: 2, workArea: { x: -1920, y: 0, width: 1920, height: 1040 } },
      state.primary,
    ],
  },
}));
vi.mock('./storage/settingsWindowBounds', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./storage/settingsWindowBounds')>();
  return {
    ...actual,
    initializeSettingsWindowBounds: () => currentStore().load(),
    readSettingsWindowBounds: () => state.store?.get(),
    saveSettingsWindowBounds: (rect: Rect) => state.store?.save(rect),
  };
});
vi.mock('./storage/storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('./storage/dashboards', () => ({
  getDashboard: vi.fn(),
  getCurrentProfileId: () => 'default',
}));
vi.mock('./storage/chromiumFlags', () => ({
  getChromiumFlags: () => ({}),
  parseCustomSwitches: () => [],
}));
vi.mock('./perfRendererArguments', () => ({
  createRendererPerfArguments: () => [],
}));
vi.mock('./hardenWindow', () => ({ hardenWindow: vi.fn() }));
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { OverlayManager } = await import('./overlayManager');
const { createSettingsWindowBoundsStore } =
  await import('./storage/settingsWindowBounds');
const { flushSettingsWindowMovementOnShutdown } =
  await import('./trackWindowMovement');
const { readData } = await import('./storage/storage');
const { app } = await import('electron');
let directory: string;
beforeEach(async () => {
  vi.clearAllMocks();
  windows.length = 0;
  state.primary = {
    id: 1,
    scaleFactor: 1,
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    workArea: { x: 0, y: 40, width: 2560, height: 1400 },
  };
  directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'irdashies-window-'));
  state.store = createSettingsWindowBoundsStore(directory);
});
afterEach(async () => {
  flushSettingsWindowMovementOnShutdown();
  await state.store?.flush();
  await fsp.rm(directory, { recursive: true, force: true });
});

describe('settings BrowserWindow construction and persistence', () => {
  it('defaults and centres a fresh install in the primary usable workArea', async () => {
    await currentStore().load();
    new OverlayManager().createSettingsWindow();
    expect(windows[0].rectangle).toEqual({
      x: 640,
      y: 340,
      width: 1280,
      height: 800,
    });
    expect(windows[0].options).toMatchObject({ frame: true, show: false });
    expect(windows[0].options).not.toHaveProperty('minWidth');
    expect(windows[0].options).not.toHaveProperty('minHeight');
    windows[0].emit('ready-to-show');
    expect(windows[0].show).toHaveBeenCalledOnce();
    expect(windows[0].focus).toHaveBeenCalledOnce();
    expect(readData).not.toHaveBeenCalledWith('settingsWindowBounds');
  });

  it('discards an arbitrary old rectangle, then restores a later resize on the next launch', async () => {
    const config = JSON.stringify({
      settingsWindowBounds: { x: -1800, y: 5, width: 1700, height: 950 },
      otherPreference: true,
    });
    await fsp.writeFile(path.join(directory, 'config.json'), config);
    await currentStore().load();
    new OverlayManager().createSettingsWindow();
    const first = windows[0];
    expect(first.rectangle).toMatchObject({ width: 1280, height: 800 });
    const custom = { x: 230, y: 90, width: 1800, height: 1100 };
    first.rectangle = custom;
    first.emit('resized');
    flushSettingsWindowMovementOnShutdown();
    await currentStore().flush();
    state.store = createSettingsWindowBoundsStore(directory);
    await state.store.load();
    new OverlayManager().createSettingsWindow();
    expect(windows[1].rectangle).toEqual(custom);
    expect(
      await fsp.readFile(path.join(directory, 'config.json'), 'utf8')
    ).toBe(config);
  });

  it.each([
    [0, 32, 1366, 728, 1, 1229, 655],
    [-1600, -900, 1280, 680, 1.5, 1152, 612],
    [500, 100, 1536, 824, 2, 1280, 741],
    [0, 0, 3440, 1400, 1, 1280, 800],
    [40, -1500, 900, 1560, 1.25, 810, 800],
    [0, 0, 100, 60, 2, 90, 54],
  ])(
    'uses logical workArea (%i,%i %ix%i, scale %f)',
    async (x, y, width, height, scaleFactor, w, h) => {
      state.primary.workArea = { x, y, width, height };
      state.primary.scaleFactor = scaleFactor;
      // Physical-looking full bounds deliberately disagree with logical workArea.
      state.primary.bounds = { x: 0, y: 0, width: 3840, height: 2160 };
      await currentStore().load();
      new OverlayManager().createSettingsWindow();
      expect(windows[0].rectangle).toEqual({
        width: w,
        height: h,
        x: Math.round(x + (width - w) / 2),
        y: Math.round(y + (height - h) / 2),
      });
    }
  );

  it('reuses and reveals a minimized window without re-defaulting or changing bounds', async () => {
    await currentStore().load();
    const manager = new OverlayManager();
    const first = manager.createSettingsWindow();
    const custom = { x: 10, y: 50, width: 900, height: 600 };
    windows[0].rectangle = custom;
    windows[0].isMinimized.mockReturnValue(true);
    expect(manager.createSettingsWindow()).toBe(first);
    manager.focusSettingsWindow('relative');
    expect(windows).toHaveLength(1);
    expect(windows[0].rectangle).toEqual(custom);
    expect(windows[0].restore).toHaveBeenCalledTimes(2);
    expect(windows[0].show).toHaveBeenCalledTimes(2);
    expect(windows[0].webContents.send).toHaveBeenCalledWith(
      'navigateToSettings',
      'relative'
    );
  });

  it.each([1, 1.25, 1.5, 2])(
    'keeps the same logical geometry at scale %f',
    async (scaleFactor) => {
      state.primary.scaleFactor = scaleFactor;
      await currentStore().load();
      new OverlayManager().createSettingsWindow();
      expect(windows[0].rectangle).toEqual({
        x: 640,
        y: 340,
        width: 1280,
        height: 800,
      });
    }
  );

  it('restores a reachable later rectangle on a secondary display', async () => {
    await currentStore().load();
    const custom = { x: -1800, y: 70, width: 900, height: 600 };
    currentStore().save(custom);
    await currentStore().flush();
    new OverlayManager().createSettingsWindow();
    expect(windows[0].rectangle).toEqual(custom);
    windows[0].emit('ready-to-show');
    expect(windows[0].setBounds).not.toHaveBeenCalled();
  });

  it('keeps start-minimized hidden and still rescues its actual off-screen placement', async () => {
    await currentStore().load();
    const manager = new OverlayManager();
    manager.createSettingsWindow(undefined, { startHidden: true });
    windows[0].rectangle = { x: -20000, y: 50, width: 1280, height: 800 };
    windows[0].emit('ready-to-show');
    expect(windows[0].setBounds).toHaveBeenCalledWith({
      x: 640,
      y: 340,
      width: 1280,
      height: 800,
    });
    expect(windows[0].show).not.toHaveBeenCalled();
    manager.focusSettingsWindow();
    expect(windows[0].show).toHaveBeenCalledOnce();
  });

  it('rescues post-migration off-screen saved bounds without overwriting the chosen rectangle', async () => {
    await currentStore().load();
    const saved = { x: -20000, y: 50, width: 1500, height: 900 };
    currentStore().save(saved);
    await currentStore().flush();
    new OverlayManager().createSettingsWindow();
    expect(windows[0].rectangle).toEqual({
      x: 530,
      y: 290,
      width: 1500,
      height: 900,
    });
    windows[0].emit('ready-to-show');
    expect(currentStore().get()).toEqual(saved);
  });

  it('preserves a saved rectangle after an actual ready-to-show rescue emits movement events', async () => {
    await currentStore().load();
    const saved = { x: 20, y: 60, width: 900, height: 600 };
    currentStore().save(saved);
    await currentStore().flush();
    new OverlayManager().createSettingsWindow();
    windows[0].rectangle = { ...saved, x: -20000 };
    windows[0].emit('ready-to-show');
    windows[0].emit('moved');
    windows[0].emit('resized');
    flushSettingsWindowMovementOnShutdown();
    expect(currentStore().get()).toEqual(saved);
  });

  it('waits for initialization when a second-instance event arrives during startup', async () => {
    const manager = new OverlayManager();
    manager.setupSingleInstanceLock();
    const secondInstance = appEvents.on.mock.calls.find(
      ([name]) => name === 'second-instance'
    )?.[1];
    if (!secondInstance) throw new Error('missing second-instance handler');
    Reflect.apply(secondInstance, app, []);
    expect(windows).toHaveLength(0);
    await currentStore().load();
    // Drain the whenReady continuation that awaited the same initialization.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(windows).toHaveLength(1);
    expect(windows[0].rectangle).toMatchObject({ width: 1280, height: 800 });
  });
});
