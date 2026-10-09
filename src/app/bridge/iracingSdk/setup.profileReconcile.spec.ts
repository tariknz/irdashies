import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';

const ipc = vi.hoisted(() => {
  const handlers = new Map<string, () => Promise<void>>();
  return {
    handlers,
    ipcMain: {
      on: vi.fn((channel: string, handler: () => Promise<void>) => {
        handlers.set(channel, handler);
      }),
      handle: vi.fn(),
    },
  };
});
vi.mock('electron', () => ({ ipcMain: ipc.ipcMain }));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

const preference = vi.hoisted(() => ({
  current: 'iracing' as 'auto' | 'iracing' | 'lmu',
}));

vi.mock('../../storage/settingsPreferences', () => ({
  getSimulatorPreference: () => preference.current,
}));

const registry = vi.hoisted(() => ({
  built: [] as ActiveSimulator[],
  stopped: [] as ActiveSimulator[],
}));

const definitionFor = (id: ActiveSimulator) => ({
  id,
  priority: 0,
  createProbe: vi.fn(),
  loadBridge: () =>
    Promise.resolve(async () => {
      registry.built.push(id);
      return {
        onTelemetry: () => () => undefined,
        onSessionData: () => () => undefined,
        onRunningState: () => () => undefined,
        stop: () => registry.stopped.push(id),
      } as unknown as IrSdkSourceBridge;
    }),
});

vi.mock('./sims/registry', () => ({
  getAvailableSimulators: (): ActiveSimulator[] => ['iracing', 'lmu'],
  getSimDefinition: (id: ActiveSimulator) => definitionFor(id),
}));

const overlayManager = {
  setActiveSimulator: vi.fn(),
  publishMessage: vi.fn(),
} as unknown as OverlayManager;

const realPlatform = process.platform;

describe('simulator selection across profiles', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.resetModules();
    ipc.handlers.clear();
    registry.built = [];
    registry.stopped = [];
    preference.current = 'iracing';
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('does not move telemetry when the active profile changes', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    await iRacingSDKSetup(overlayManager);
    expect(registry.built).toEqual(['iracing']);

    emitDashboardUpdated({} as never);
    await Promise.resolve();

    expect(registry.built).toEqual(['iracing']);
    expect(registry.stopped).toEqual([]);
  });

  it('moves telemetry when the app preference changes', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    preference.current = 'lmu';

    await ipc.handlers.get('simulatorPreferenceChanged')?.();

    expect(registry.built).toEqual(['iracing', 'lmu']);
    expect(registry.stopped).toEqual(['iracing']);
  });

  it('keeps the bridge when the preference still resolves to the same sim', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);

    await ipc.handlers.get('simulatorPreferenceChanged')?.();

    expect(registry.built).toEqual(['iracing']);
    expect(registry.stopped).toEqual([]);
  });
});
