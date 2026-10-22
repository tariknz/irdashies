import { describe, expect, it, vi } from 'vitest';
import type { RacePlanState } from '@irdashies/types';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '') },
  safeStorage: {},
  webContents: { getAllWebContents: vi.fn(() => []) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
    ),
  },
}));
vi.mock('../logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));

const { registerRacePlanHandlers } = await import('./racePlanBridge');

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
    getActivePlan: vi.fn(() => null),
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
});
