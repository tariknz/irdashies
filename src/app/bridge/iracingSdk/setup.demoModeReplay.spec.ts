import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';

const ipcMain = vi.hoisted(() => ({ on: vi.fn(), handle: vi.fn() }));
vi.mock('electron', () => ({ ipcMain }));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

vi.mock('../../storage/dashboards', () => ({
  getCurrentProfileId: () => 'a',
  getDashboard: () => ({ generalSettings: { simulator: 'iracing' } }),
}));

const built: ActiveSimulator[] = [];

const definitionFor = (id: ActiveSimulator) => ({
  id,
  priority: 0,
  createProbe: vi.fn(),
  loadBridge: () =>
    Promise.resolve(async () => {
      built.push(id);
      return {
        onTelemetry: () => () => undefined,
        onSessionData: () => () => undefined,
        onRunningState: () => () => undefined,
        stop: () => undefined,
      } as unknown as IrSdkSourceBridge;
    }),
});

vi.mock('./sims/registry', () => ({
  getAvailableSimulators: (): ActiveSimulator[] => ['iracing', 'lmu'],
  getSimDefinition: (id: ActiveSimulator) => definitionFor(id),
}));

// The toggle imports this dynamically; the real one drags in storage and so the
// whole electron app surface.
vi.mock('../dashboard/dashboardBridge', () => ({
  notifyDemoModeChanged: vi.fn(),
}));

/**
 * Models the part of OverlayManager that matters here: publishing reaches the
 * windows that exist right now, and setActiveSimulator destroys every overlay
 * window and rebuilds it, so whatever the old windows were told is lost and
 * each new window starts from nothing. Every rebuilt window is announced again
 * through onOverlayReady, which is the only chance to tell it.
 */
const harness = vi.hoisted(() => {
  const published = new Map<string, unknown>();
  const readyIds: string[] = [];
  const readyCallbacks = new Set<(id: string) => void>();
  let activeSimulator: string | null = null;
  let rebuilds = 0;

  const rebuild = () => {
    rebuilds += 1;
    published.clear();
    readyIds.push('display-1');
    readyCallbacks.forEach((cb) => cb('display-1'));
  };

  return {
    published,
    readyIds,
    announceWindow: (id: string) => {
      readyIds.push(id);
      readyCallbacks.forEach((cb) => cb(id));
    },
    demoFlag: () => published.get('demoModeChanged'),
    rebuildCount: () => rebuilds,
    manager: {
      setActiveSimulator: (simulator: string | null) => {
        if (simulator === activeSimulator) return;
        activeSimulator = simulator;
        rebuild();
      },
      hasTelemetryInspectorSubscribers: () => false,
      clearLatestSessionData: () => undefined,
      publishMessage: (key: string, value: unknown) => {
        published.set(key, value);
      },
      publishMessageToOverlay: (_id: string, key: string, value: unknown) => {
        published.set(key, value);
      },
      onOverlayReady: (callback: (id: string) => void) => {
        readyCallbacks.add(callback);
        return () => readyCallbacks.delete(callback);
      },
      forceRefreshOverlays: rebuild,
    },
  };
});

const overlayManager = harness.manager as unknown as OverlayManager;

const realPlatform = process.platform;

const demoToggleHandler = () => {
  const call = ipcMain.on.mock.calls.find(
    ([channel]) => channel === 'toggleDemoMode'
  );
  if (!call) throw new Error('toggleDemoMode was never registered');
  return call[1] as (event: unknown, value: boolean) => Promise<void>;
};

describe('demo mode reaches the overlay windows it rebuilds', () => {
  beforeEach(() => {
    // Windows with a real sim pinned, which is what makes entering demo mode a
    // simulator change rather than a no-op.
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.resetModules();
    ipcMain.on.mockClear();
    ipcMain.handle.mockClear();
    built.length = 0;
    harness.published.clear();
    harness.readyIds.length = 0;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('replays the flag to the window the simulator change recreates', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    await demoToggleHandler()(null as never, true);

    // Entering demo mode hands the feed to the mock bridge, so the running sim
    // is cleared and every overlay window is destroyed and rebuilt. The flag
    // published to the old windows is gone with them, so the new ones only know
    // the mode if something tells them on the way up.
    expect(built).toEqual(['iracing']);
    expect(harness.rebuildCount()).toBeGreaterThan(0);
    expect(harness.demoFlag()).toBe(true);
  });

  it('replays the flag to a window announced after the toggle settled', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    await demoToggleHandler()(null as never, true);
    harness.published.clear();

    // A display added later opens a window that was never told the mode.
    harness.announceWindow('display-9');

    await vi.waitFor(() => expect(harness.demoFlag()).toBe(true));
  });

  it('tells a window built in demo mode, without waiting for a toggle', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    await demoToggleHandler()(null as never, true);

    // The first window rebuilt by the rebuild triggered above is announced
    // before the replay code exists in its own timeline, so a window that only
    // ever gets an onOverlayReady must still end up knowing the mode.
    harness.published.clear();
    harness.announceWindow('display-4');

    await vi.waitFor(() => expect(harness.demoFlag()).toBe(true));
  });

  it('tells a window that was never in demo mode that it is not', async () => {
    const { iRacingSDKSetup } = await import('./setup');
    await iRacingSDKSetup(overlayManager);
    harness.published.clear();

    // Sending the current value is the point: a window built after the user left
    // demo mode must not inherit the flag from an earlier turn.
    harness.announceWindow('display-3');
    await Promise.resolve();

    expect(harness.demoFlag()).toBe(false);
  });
});
