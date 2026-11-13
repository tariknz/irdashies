import { EventEmitter } from 'node:events';
import { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { RacePlanState } from '@irdashies/types';
import { createRacePlanService } from '../services/racePlanService';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '') },
  safeStorage: {},
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
    ),
    removeHandler: vi.fn(),
  },
}));
vi.mock('../logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('../storage/racePlanStore', () => ({ createRacePlanStore: vi.fn() }));
vi.mock('../services/racePlanService', () => ({
  createRacePlanService: vi.fn(),
}));

const {
  createRacePlanBroadcast,
  registerRacePlanHandlers,
  setupRacePlanBridge,
} = await import('./racePlanBridge');

const state = { hasApiKey: true } as RacePlanState;

const fakeService = () => {
  const listeners = new Set<(s: RacePlanState) => void>();
  return {
    ready: Promise.resolve(),
    getState: vi.fn(async () => state),
    choosePlanning: vi.fn(async () => ({ status: 'not-found' as const })),
    setConfig: vi.fn(async () => state),
    setApiKey: vi.fn(async () => state),
    clearApiKey: vi.fn(async () => state),
    listPlannings: vi.fn(async () => ({ status: 'unauthorized' as const })),
    refreshNow: vi.fn(async () => state),
    getPlanning: vi.fn(() => null),
    onChange: vi.fn((listener: (s: RacePlanState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    dispose: vi.fn(),
    emit: (s: RacePlanState) => listeners.forEach((l) => l(s)),
  };
};

describe('racePlanBridge', () => {
  it('registers one handler per call and passes renderer input to the service', async () => {
    const service = fakeService();
    registerRacePlanHandlers(service, vi.fn());
    expect([...handlers.keys()].sort()).toEqual([
      'racePlan:choosePlanning',
      'racePlan:clearApiKey',
      'racePlan:getState',
      'racePlan:listPlannings',
      'racePlan:refreshNow',
      'racePlan:setApiKey',
      'racePlan:setConfig',
    ]);
    await handlers.get('racePlan:choosePlanning')?.({}, 3);
    expect(service.choosePlanning).toHaveBeenCalledWith(3);
    await handlers.get('racePlan:setConfig')?.({}, { refreshMinutes: 3 });
    expect(service.setConfig).toHaveBeenCalledWith({ refreshMinutes: 3 });
    await handlers.get('racePlan:setApiKey')?.({}, 'k');
    expect(service.setApiKey).toHaveBeenCalledWith('k');
  });

  it('broadcasts service changes until disposed', () => {
    const service = fakeService();
    const broadcast = vi.fn();
    const unsubscribe = registerRacePlanHandlers(service, broadcast);
    service.emit(state);
    expect(broadcast).toHaveBeenCalledWith(state);
    unsubscribe();
    service.emit(state);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('delivers the latest missed state when a minimized subscriber restores', () => {
    const service = fakeService();
    vi.mocked(createRacePlanService).mockReturnValue(service);
    const sender = Object.assign(new EventEmitter(), { id: 1, send: vi.fn() });
    const window = Object.assign(new EventEmitter(), {
      id: 1,
      visible: false,
      isDestroyed: () => false,
      isVisible: () => window.visible,
      webContents: sender,
    });
    const browserWindow = window as unknown as BrowserWindow;
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(browserWindow);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([browserWindow]);
    const bridge = setupRacePlanBridge();
    try {
      handlers.get('racePlan:subscribe')?.({ sender }, 'state');
      handlers.get('racePlan:subscribe')?.({ sender }, 'state');
      service.emit(state);
      const latest = { ...state, status: 'network' as const };
      service.emit(latest);
      expect(sender.send).not.toHaveBeenCalled();

      window.visible = true;
      window.emit('restore');
      expect(sender.send).toHaveBeenCalledExactlyOnceWith(
        'racePlan:state',
        latest
      );
      window.emit('show');
      expect(sender.send).toHaveBeenCalledTimes(2);
    } finally {
      bridge.dispose();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);
    }
  });
});

describe('createRacePlanBroadcast', () => {
  const window = (id: number, visible = true) => ({
    visible,
    isDestroyed: () => false,
    isVisible() {
      return this.visible;
    },
    webContents: { id, send: vi.fn() },
  });

  it('sends only to visible windows that subscribed', () => {
    const subscribed = window(1);
    const other = window(2);
    const hidden = window(3, false);
    const broadcast = createRacePlanBroadcast(
      (id) => id !== 2,
      () => [subscribed, other, hidden]
    );
    broadcast.send(state);
    expect(subscribed.webContents.send).toHaveBeenCalledWith(
      'racePlan:state',
      state
    );
    expect(other.webContents.send).not.toHaveBeenCalled();
    expect(hidden.webContents.send).not.toHaveBeenCalled();
  });

  it('catches a hidden subscriber up when it is shown', () => {
    const hidden = window(3, false);
    const broadcast = createRacePlanBroadcast(
      () => true,
      () => [hidden]
    );
    broadcast.onShown(hidden);
    expect(hidden.webContents.send).not.toHaveBeenCalled();
    broadcast.send(state);
    hidden.visible = true;
    broadcast.onShown(hidden);
    expect(hidden.webContents.send).toHaveBeenCalledWith(
      'racePlan:state',
      state
    );
  });
});
