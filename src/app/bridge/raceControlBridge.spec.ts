import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import type { IncidentRuntimeHandle } from './raceControlBridge';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const dashboardListeners = new Set<(dashboard: DashboardLayout) => void>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
    ),
  },
}));

vi.mock('./iracingSdk/setup', () => ({
  getCurrentBridge: vi.fn(() => undefined),
  onBridgeChanged: vi.fn(),
}));

vi.mock('../storage/incidentStorage', () => ({
  loadIncidents: vi.fn(() => Promise.resolve([])),
  clearIncidents: vi.fn(() => Promise.resolve()),
  pruneOldSessions: vi.fn(() => Promise.resolve()),
}));

vi.mock('../storage/dashboardEvents', () => ({
  onDashboardUpdated: vi.fn((listener: (d: DashboardLayout) => void) => {
    dashboardListeners.add(listener);
    return () => dashboardListeners.delete(listener);
  }),
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { setupRaceControlBridge } = await import('./raceControlBridge');
const { loadIncidents, clearIncidents, pruneOldSessions } =
  await import('../storage/incidentStorage');

const savedThresholds = {
  slowSpeedThreshold: 21,
  slowDurationSeconds: 1.5,
  impactDecelKmhPerSec: 200,
  impactMinSpeed: 25,
  offTrackDurationSeconds: 0.5,
  pitEntryDurationSeconds: 0.8,
  cooldownSeconds: 9,
};

const dashboardWith = (config: Record<string, unknown>) =>
  ({
    widgets: [{ id: 'gantry', enabled: true, config }],
  }) as unknown as DashboardLayout;

const createRuntime = () => {
  let sessionIdChanged: (id: string) => void = () => undefined;
  const runtime: IncidentRuntimeHandle = {
    onSession: vi.fn(),
    onFrame: vi.fn(),
    updateEnabled: vi.fn(),
    updateThresholds: vi.fn(),
    getCurrentSessionId: vi.fn(() => '1'),
    onSessionIdChanged: vi.fn((cb: (id: string) => void) => {
      sessionIdChanged = cb;
      return () => undefined;
    }),
  };
  return { runtime, changeSessionId: () => sessionIdChanged('2') };
};

describe('setupRaceControlBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    dashboardListeners.clear();
  });

  it('applies the saved thresholds at startup instead of leaving detection on defaults', () => {
    const { runtime } = createRuntime();

    setupRaceControlBridge(
      runtime,
      dashboardWith({ ...savedThresholds, sessionRetention: 5 })
    );

    expect(runtime.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining(savedThresholds)
    );
    expect(runtime.updateEnabled).toHaveBeenCalledWith(true);
  });

  it('applies the saved retention at startup', async () => {
    const { runtime } = createRuntime();

    setupRaceControlBridge(
      runtime,
      dashboardWith({ ...savedThresholds, sessionRetention: 5 })
    );
    expect(pruneOldSessions).toHaveBeenCalledWith(5);
  });

  it('prunes immediately when retention is updated', () => {
    const { runtime } = createRuntime();
    setupRaceControlBridge(runtime);
    vi.mocked(pruneOldSessions).mockClear();

    handlers.get('raceControl:updateRetention')?.({}, 5);

    expect(pruneOldSessions).toHaveBeenCalledWith(5);
  });

  it('does not prune when the runtime clears its session id', () => {
    const { runtime } = createRuntime();
    setupRaceControlBridge(runtime);
    const listener = vi.mocked(runtime.onSessionIdChanged).mock.calls[0][0];

    listener('');

    expect(pruneOldSessions).not.toHaveBeenCalled();
  });

  it('re-applies settings when the dashboard changes (profile switch)', () => {
    const { runtime } = createRuntime();
    setupRaceControlBridge(
      runtime,
      dashboardWith({ ...savedThresholds, sessionRetention: 5 })
    );
    vi.mocked(runtime.updateThresholds).mockClear();

    dashboardListeners.forEach((listener) =>
      listener(
        dashboardWith({
          ...savedThresholds,
          cooldownSeconds: 3,
          sessionRetention: 20,
        })
      )
    );
    expect(runtime.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({ cooldownSeconds: 3 })
    );
    expect(pruneOldSessions).toHaveBeenCalledWith(20);
  });

  it('keeps the detector defaults when the saved config is malformed', () => {
    const { runtime } = createRuntime();

    setupRaceControlBridge(
      runtime,
      dashboardWith({ slowSpeedThreshold: 'fast', sessionRetention: 'all' })
    );

    expect(runtime.updateThresholds).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', { ...savedThresholds, offTrackDurationSeconds: 0 }],
    ['negative', { ...savedThresholds, slowDurationSeconds: -1 }],
    ['below the minimum', { ...savedThresholds, impactDecelKmhPerSec: 10 }],
    ['excessive', { ...savedThresholds, impactDecelKmhPerSec: 1_000_000_000 }],
  ])('rejects %s durations', (_label, thresholds) => {
    const { runtime } = createRuntime();
    setupRaceControlBridge(runtime);

    handlers.get('raceControl:updateThresholds')?.({}, thresholds);

    expect(runtime.updateThresholds).not.toHaveBeenCalled();
  });

  it('accepts fractional durations, which frame counts could not express', () => {
    const { runtime } = createRuntime();
    setupRaceControlBridge(runtime);

    const thresholds = { ...savedThresholds, offTrackDurationSeconds: 0.35 };
    handlers.get('raceControl:updateThresholds')?.({}, thresholds);

    expect(runtime.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({ offTrackDurationSeconds: 0.35 })
    );
  });

  it('does nothing when the dashboard has no gantry widget', () => {
    const { runtime } = createRuntime();

    setupRaceControlBridge(runtime, {
      widgets: [],
    } as unknown as DashboardLayout);

    expect(runtime.updateThresholds).not.toHaveBeenCalled();
    expect(runtime.updateEnabled).toHaveBeenCalledWith(false);
  });

  it('does not read or clear incident storage without a session id', async () => {
    const { runtime } = createRuntime();
    vi.mocked(runtime.getCurrentSessionId).mockReturnValue('');
    setupRaceControlBridge(runtime);

    expect(handlers.get('raceControl:getIncidents')?.({})).toEqual({
      sessionId: '',
      incidents: [],
    });
    expect(handlers.get('raceControl:clearIncidents')?.({})).toBeUndefined();
    expect(loadIncidents).not.toHaveBeenCalled();
    expect(clearIncidents).not.toHaveBeenCalled();
  });
});
