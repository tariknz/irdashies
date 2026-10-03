import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';

const ipcMain = vi.hoisted(() => ({ on: vi.fn(), handle: vi.fn() }));
vi.mock('electron', () => ({ ipcMain }));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Only ever referenced as a type by setup.ts, but stubbed so the spec does not
// drag the real window manager in.
vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

const storage = vi.hoisted(() => ({
  profileId: 'a',
  simulatorFor: {} as Record<string, ActiveSimulator>,
  /** Counts resolutions, so a reconcile that reuses the bridge is still visible. */
  reads: 0,
}));

vi.mock('../../storage/dashboards', () => ({
  getCurrentProfileId: () => storage.profileId,
  getDashboard: (id: string) => {
    storage.reads += 1;
    return { generalSettings: { simulator: storage.simulatorFor[id] } };
  },
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
    // The preference is only honoured on the real-SDK path; the non-Windows
    // fallback builds the mock bridge whatever it says.
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.resetModules();
    registry.built = [];
    registry.stopped = [];
    storage.profileId = 'a';
    storage.reads = 0;
    storage.simulatorFor = { a: 'iracing', b: 'lmu' };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('moves the telemetry source when the active profile pins another sim', async () => {
    // Otherwise the settings window names the new profile's simulator while
    // the previous source keeps feeding the overlays.
    const { iRacingSDKSetup } = await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    await iRacingSDKSetup(overlayManager);
    expect(registry.built).toEqual(['iracing']);

    storage.profileId = 'b';
    emitDashboardUpdated({} as never);

    await vi.waitFor(() => expect(registry.built).toEqual(['iracing', 'lmu']));
    expect(registry.stopped).toEqual(['iracing']);
  });

  it('leaves the bridge alone for an ordinary settings save', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    await iRacingSDKSetup(overlayManager);

    const readsBefore = storage.reads;
    emitDashboardUpdated({} as never);
    await Promise.resolve();

    // Not even resolved: a settings save must not reach the bridge at all.
    expect(storage.reads).toBe(readsBefore);
    expect(registry.built).toEqual(['iracing']);
    expect(registry.stopped).toEqual([]);
  });

  it('keeps the bridge when the new profile resolves to the same sim', async () => {
    // The reuse check is what stops a profile switch disconnecting overlays
    // that were already on the right source.
    storage.simulatorFor = { a: 'iracing', b: 'iracing' };
    const { iRacingSDKSetup } = await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    await iRacingSDKSetup(overlayManager);

    const readsBefore = storage.reads;
    storage.profileId = 'b';
    emitDashboardUpdated({} as never);

    // The reconcile ran and resolved the new profile...
    await vi.waitFor(() => expect(storage.reads).toBeGreaterThan(readsBefore));
    // ...and decided the live bridge was already the one it would have built.
    expect(registry.built).toEqual(['iracing']);
    expect(registry.stopped).toEqual([]);
  });
});
