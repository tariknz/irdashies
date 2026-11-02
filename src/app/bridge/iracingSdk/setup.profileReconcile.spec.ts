import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import logger from '../../logger';

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
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

const dashboard = vi.hoisted(() => ({
  profileId: 'default',
  simulator: 'iracing' as 'auto' | 'iracing' | 'lmu' | undefined,
}));

vi.mock('../../storage/dashboards', () => ({
  getCurrentProfileId: () => dashboard.profileId,
  getDashboard: () => ({
    generalSettings: { simulator: dashboard.simulator },
  }),
}));

const registry = vi.hoisted(() => ({
  built: [] as ActiveSimulator[],
  stopped: [] as ActiveSimulator[],
  failure: undefined as Error | undefined,
}));

const definitionFor = (id: ActiveSimulator) => ({
  id,
  priority: 0,
  createProbe: vi.fn(),
  loadBridge: () =>
    registry.failure
      ? Promise.reject(registry.failure)
      : Promise.resolve(async () => {
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
    registry.failure = undefined;
    dashboard.profileId = 'default';
    dashboard.simulator = 'iracing';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('logs the underlying bridge loader exception before rethrowing it', async () => {
    const failure = Object.assign(
      new Error('Native module dependency not found'),
      {
        code: 'ERR_DLOPEN_FAILED',
      }
    );
    registry.failure = failure;
    const { iRacingSDKSetup } = await import('./setup');
    await expect(iRacingSDKSetup(overlayManager)).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith('Failed to load bridge', failure);
  });

  it('selects the LMU tape on macOS despite an iRacing profile preference', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.stubEnv('IRDASHIES_LMU_REPLAY', 'session.lmudt');
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    expect(registry.built).toEqual(['lmu']);
  });

  it('moves the telemetry source when the active profile pins another sim', async () => {
    // Otherwise the settings window names the new profile's simulator while
    // the previous source keeps feeding the overlays.
    const { iRacingSDKSetup } = await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    await iRacingSDKSetup(overlayManager);
    expect(registry.built).toEqual(['iracing']);

    // Same profile id: an ordinary settings save must not tear the bridge down.
    emitDashboardUpdated({} as never);
    await Promise.resolve();

    expect(registry.built).toEqual(['iracing']);
    expect(registry.stopped).toEqual([]);
  });

  it('moves telemetry when the app preference changes', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    dashboard.simulator = 'lmu';

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
