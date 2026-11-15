import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';

const ipcMain = vi.hoisted(() => ({ on: vi.fn(), handle: vi.fn() }));
vi.mock('electron', () => ({ ipcMain }));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../overlayManager', () => ({ OverlayManager: vi.fn() }));

vi.mock('../dashboard/dashboardBridge', () => ({
  notifyDemoModeChanged: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  profileId: 'a',
  simulatorFor: {} as Record<string, ActiveSimulator>,
}));

vi.mock('../../storage/dashboards', () => ({
  getCurrentProfileId: () => storage.profileId,
  getDashboard: (id: string) => ({
    generalSettings: { simulator: storage.simulatorFor[id] },
  }),
}));

/**
 * Each bridge replays its current running state to a new subscriber, as the
 * real ones do. Stopping one leaves its subscribers in place, so a test can
 * tell whether setup let go of it.
 */
const bridges = vi.hoisted(() => ({
  running: {} as Record<string, boolean | undefined>,
  listeners: {} as Record<string, Set<(running: boolean) => void>>,
}));

const fakeBridge = (id: string) => {
  const listeners = new Set<(running: boolean) => void>();
  bridges.listeners[id] = listeners;
  return {
    onTelemetry: () => () => undefined,
    onSessionData: () => () => undefined,
    onRunningState: (callback: (running: boolean) => void) => {
      listeners.add(callback);
      const running = bridges.running[id];
      if (running !== undefined) callback(running);
      return () => listeners.delete(callback);
    },
    stop: vi.fn(),
  } as unknown as IrSdkSourceBridge;
};

const setRunning = (id: string, running: boolean) => {
  bridges.running[id] = running;
  bridges.listeners[id]?.forEach((callback) => callback(running));
};

/** Which simulators auto-detect's probes find running. */
const probes = vi.hoisted(() => ({
  active: {} as Record<string, boolean | undefined>,
}));

vi.mock('./sims/registry', () => {
  const definition = (id: ActiveSimulator) => ({
    id,
    priority: 0,
    createProbe: async () => ({
      start: () => undefined,
      isActive: () => Boolean(probes.active[id]),
      stop: () => undefined,
    }),
    loadBridge: () => Promise.resolve(async () => fakeBridge(id)),
  });
  return {
    getAvailableSimulators: (): ActiveSimulator[] => ['iracing', 'lmu'],
    getSimDefinition: definition,
    getSimDefinitions: () => [definition('iracing'), definition('lmu')],
  };
});

vi.mock('./mock-data/mockSdkBridge', () => ({
  publishIRacingSDKEvents: async () => fakeBridge('demo'),
}));

const overlayManager = {
  setActiveSimulator: vi.fn(),
  publishMessage: vi.fn(),
} as unknown as OverlayManager;

const realPlatform = process.platform;

describe('onConnectedSimulatorChanged', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.resetModules();
    ipcMain.on.mockClear();
    storage.profileId = 'a';
    storage.simulatorFor = { a: 'iracing', b: 'lmu' };
    bridges.running = {};
    bridges.listeners = {};
    probes.active = {};
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it.each([
    ['linux', undefined, undefined, 'mock'],
    ['win32', undefined, undefined, 'live'],
    ['win32', '/tmp/capture.irdt', undefined, 'tape'],
    ['win32', undefined, '1', 'sdk-replay'],
  ])(
    'records the source actually selected on %s',
    async (platform, tape, sdkReplay, expected) => {
      Object.defineProperty(process, 'platform', { value: platform });
      vi.stubEnv('PERF_METRICS', '1');
      vi.stubEnv('PERF_SOURCE_KIND', '');
      vi.stubEnv('IRDASHIES_TELEMETRY_REPLAY', tape);
      vi.stubEnv('IRDASHIES_IRSDK_REPLAY', sdkReplay);
      const { iRacingSDKSetup } = await import('./setup');

      await iRacingSDKSetup(overlayManager);

      expect(process.env.PERF_SOURCE_KIND).toBe(expected);
    }
  );

  it('reports a simulator that was already running as irdashies started', async () => {
    bridges.running.iracing = true;
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);
    expect(connected.mock.calls).toEqual([['iracing']]);
  });

  it('reports each connect and disconnect once, however often the state repeats', async () => {
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);
    expect(connected).not.toHaveBeenCalled();

    setRunning('iracing', true);
    setRunning('iracing', true);
    setRunning('iracing', false);
    setRunning('iracing', true);
    expect(connected.mock.calls).toEqual([
      ['iracing'],
      [undefined],
      ['iracing'],
    ]);
  });

  it('tells a late subscriber about a simulator that is connected now', async () => {
    bridges.running.iracing = true;
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    await iRacingSDKSetup(overlayManager);

    const late = vi.fn();
    onConnectedSimulatorChanged(late);
    expect(late.mock.calls).toEqual([['iracing']]);

    setRunning('iracing', false);
    const afterDisconnect = vi.fn();
    onConnectedSimulatorChanged(afterDisconnect);
    expect(afterDisconnect).not.toHaveBeenCalled();
  });

  it('follows the new source when a profile moves it, and lets go of the old one', async () => {
    bridges.running = { iracing: true, lmu: true };
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const { emitDashboardUpdated } =
      await import('../../storage/dashboardEvents');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);

    storage.profileId = 'b';
    emitDashboardUpdated({} as never);
    await vi.waitFor(() =>
      expect(connected.mock.calls).toEqual([['iracing'], [undefined], ['lmu']])
    );

    // The replaced bridge stopping and starting again says nothing about LMU.
    setRunning('iracing', false);
    setRunning('iracing', true);
    expect(connected.mock.calls).toEqual([['iracing'], [undefined], ['lmu']]);
  });

  describe('with auto-detect', () => {
    beforeEach(() => {
      // No profile pins a simulator, so the façade probes for one.
      storage.simulatorFor = {};
    });

    it('reports the simulator it attaches to, already running at startup', async () => {
      // The façade names the sim before its bridge replays "running".
      probes.active.lmu = true;
      bridges.running.lmu = true;
      const { iRacingSDKSetup, onConnectedSimulatorChanged } =
        await import('./setup');
      const connected = vi.fn();
      onConnectedSimulatorChanged(connected);
      await iRacingSDKSetup(overlayManager);
      await vi.waitFor(() => expect(connected.mock.calls).toEqual([['lmu']]));
    });

    it('reports the simulator it attached to when that one starts running', async () => {
      probes.active.iracing = true;
      const { iRacingSDKSetup, onConnectedSimulatorChanged } =
        await import('./setup');
      const connected = vi.fn();
      onConnectedSimulatorChanged(connected);
      await iRacingSDKSetup(overlayManager);
      await vi.waitFor(() => expect(bridges.listeners.iracing?.size).toBe(1));
      expect(connected).not.toHaveBeenCalled();
      setRunning('iracing', true);
      expect(connected.mock.calls).toEqual([['iracing']]);
    });

    it('reports the new simulator when another takes over', async () => {
      probes.active.iracing = true;
      bridges.running.iracing = true;
      const { iRacingSDKSetup, onConnectedSimulatorChanged } =
        await import('./setup');
      const connected = vi.fn();
      onConnectedSimulatorChanged(connected);
      await iRacingSDKSetup(overlayManager);
      await vi.waitFor(() =>
        expect(connected.mock.calls).toEqual([['iracing']])
      );

      // iRacing closes with LMU already up: the watchdog hands over to it.
      probes.active.lmu = true;
      bridges.running.lmu = true;
      setRunning('iracing', false);
      await vi.waitFor(() =>
        expect(connected.mock.calls).toEqual([
          ['iracing'],
          [undefined],
          ['lmu'],
        ])
      );
    });
  });

  it('never counts a tape', async () => {
    vi.stubEnv('IRDASHIES_LMU_REPLAY', 'session.lmudt');
    bridges.running.lmu = true;
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);
    expect(connected).not.toHaveBeenCalled();
  });

  it('never counts an isolated SDK replay', async () => {
    vi.stubEnv('IRDASHIES_IRSDK_REPLAY', '1');
    bridges.running.iracing = true;
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);
    expect(connected).not.toHaveBeenCalled();
  });

  it('never counts demo mode, and ends the connection it replaced', async () => {
    bridges.running = { iracing: true, demo: true };
    const { iRacingSDKSetup, onConnectedSimulatorChanged } =
      await import('./setup');
    const connected = vi.fn();
    onConnectedSimulatorChanged(connected);
    await iRacingSDKSetup(overlayManager);

    const toggleDemoMode = ipcMain.on.mock.calls.find(
      ([channel]) => channel === 'toggleDemoMode'
    )?.[1] as (event: unknown, value: boolean) => Promise<void>;
    await toggleDemoMode({}, true);

    const late = vi.fn();
    onConnectedSimulatorChanged(late);
    expect(late).not.toHaveBeenCalled();
    expect(connected.mock.calls).toEqual([['iracing'], [undefined]]);
  });
});
