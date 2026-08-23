import { describe, expect, it, vi } from 'vitest';
import type { LapHistorySnapshot, Session, Telemetry } from '@irdashies/types';
import { TrackLocation } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import {
  LapHistoryRuntime,
  type LapHistoryPersistence,
  type StoredLapHistory,
} from './lapHistoryRuntime';

const raceSession = (subSessionId = 123): Session =>
  ({
    WeekendInfo: { SubSessionID: subSessionId },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
    DriverInfo: { Drivers: [{ CarIdx: 0, UserName: 'Test' }] },
  }) as unknown as Session;

interface FrameFixture {
  sessionTime?: number;
  sessionNum?: number;
  laps: number[];
}

const frame = (fixture: FrameFixture): Telemetry =>
  ({
    SessionTime: { value: [fixture.sessionTime ?? 0] },
    SessionNum: { value: [fixture.sessionNum ?? 0] },
    CarIdxLap: { value: fixture.laps },
    CarIdxClassPosition: { value: fixture.laps.map(() => 1) },
    CarIdxOnPitRoad: { value: fixture.laps.map(() => false) },
    CarIdxTrackSurface: {
      value: fixture.laps.map(() => TrackLocation.OnTrack),
    },
  }) as unknown as Telemetry;

const newMetrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

const newPersistence = (stored: StoredLapHistory | null = null) => ({
  save: vi.fn<LapHistoryPersistence['save']>(),
  load: vi.fn<LapHistoryPersistence['load']>(() => Promise.resolve(stored)),
});

/** Lets the persistence promise settle before the next frame. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const crossingCount = (snapshot: LapHistorySnapshot, carIdx: number): number =>
  snapshot.count[carIdx];

const writeCrossing = (
  target: LapHistorySnapshot,
  carIdx: number,
  lap: number,
  sessionTime: number
): void => {
  const slot = carIdx * target.capacity;
  (target.lap as number[])[slot] = lap;
  (target.sessionTime as number[])[slot] = sessionTime;
  (target.classPosition as number[])[slot] = 1;
  (target.flags as number[])[slot] = 0;
  (target.count as number[])[carIdx] = 1;
  (target.start as number[])[carIdx] = 0;
};

describe('LapHistoryRuntime', () => {
  it('does not process or persist frames while Gantry is disabled', () => {
    const metrics = newMetrics();
    const persistence = newPersistence();
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      metrics,
      persistence
    );
    runtime.onSession(raceSession());
    runtime.updateEnabled(false);

    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));

    expect(metrics.markStart).not.toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
    expect(crossingCount(runtime.snapshot(), 0)).toBe(0);
  });

  it('records, publishes, and persists with zero channel subscribers', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = newMetrics();
    const persistence = newPersistence();
    const runtime = new LapHistoryRuntime(
      bus,
      createSessionLifecycle(),
      metrics,
      persistence
    );

    // Regression guard: recording must not be gated on channel demand, so the
    // Gantry window can be closed for the whole race.
    expect(bus.subscriberCount('lap-history.snapshot')).toBe(0);

    runtime.onSession(raceSession());
    await settle();
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));

    expect(bus.subscriberCount('lap-history.snapshot')).toBe(0);
    expect(crossingCount(runtime.snapshot(), 0)).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      'lap-history.snapshot',
      runtime.snapshot()
    );
    expect(persistence.save).toHaveBeenCalledWith('123', runtime.snapshot());
    expect(metrics.markStart).toHaveBeenCalledWith('lapHistoryProcessing');
    expect(metrics.markEnd).toHaveBeenCalledWith('lapHistoryProcessing');
    expect(metrics.markStart).toHaveBeenCalledWith('lapHistoryPublication');
    expect(metrics.markEnd).toHaveBeenCalledWith('lapHistoryPublication');
  });

  it('resends the recorded race when a window resubscribes after the last lap', async () => {
    const bus = new ChannelBus();
    const metrics = newMetrics();
    const runtime = new LapHistoryRuntime(
      bus,
      createSessionLifecycle(),
      metrics,
      newPersistence()
    );

    runtime.onSession(raceSession());
    await settle();
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(crossingCount(runtime.snapshot(), 0)).toBe(1);

    const delivered: unknown[] = [];
    const window = {
      id: 1,
      isDestroyed: () => false,
      isVisible: () => true,
      send: (_channel: string, _name: string, payload: unknown) =>
        delivered.push(payload),
    };

    // The Gantry shows the Lap Graph tab, then the user switches away. The bus
    // drops its cached snapshot once the last subscriber goes.
    bus.subscribe(window, 'lap-history.snapshot');
    bus.unsubscribe(window.id, 'lap-history.snapshot');
    delivered.length = 0;

    // The race is over, so no further lap will ever be completed and nothing
    // would publish again. Coming back to the tab must still show the race.
    bus.subscribe(window, 'lap-history.snapshot');

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toBe(runtime.snapshot());
  });

  it('does not resend an empty history to a new subscriber', async () => {
    const bus = new ChannelBus();
    const runtime = new LapHistoryRuntime(
      bus,
      createSessionLifecycle(),
      newMetrics(),
      newPersistence()
    );

    runtime.onSession(raceSession());
    await settle();

    const delivered: unknown[] = [];
    const window = {
      id: 2,
      isDestroyed: () => false,
      isVisible: () => true,
      send: (_channel: string, _name: string, payload: unknown) =>
        delivered.push(payload),
    };
    bus.subscribe(window, 'lap-history.snapshot');

    expect(delivered).toHaveLength(0);
    void runtime;
  });

  it('publishes only when the snapshot version moves', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const runtime = new LapHistoryRuntime(
      bus,
      createSessionLifecycle(),
      newMetrics(),
      newPersistence()
    );
    runtime.onSession(raceSession());
    await settle();
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    publish.mockClear();

    // Same lap, nothing recorded, nothing to send.
    runtime.onFrame(frame({ sessionTime: 110, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 120, laps: [4] }));
    expect(publish).not.toHaveBeenCalled();

    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('never persists an empty snapshot', async () => {
    const persistence = newPersistence();
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );
    runtime.onSession(raceSession());
    await settle();

    // The first frame rebaselines and bumps the version, but records nothing.
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));

    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('reloads persisted history when the session id changes', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const persistence = newPersistence({
      sessionNum: 0,
      apply: (target) => {
        writeCrossing(target, 2, 11, 990);
        return true;
      },
    });
    const runtime = new LapHistoryRuntime(
      bus,
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession(456));
    expect(persistence.load).toHaveBeenCalledWith('456');
    await settle();

    runtime.onFrame(frame({ sessionTime: 1000, laps: [4] }));

    const snapshot = runtime.snapshot();
    expect(crossingCount(snapshot, 2)).toBe(1);
    expect(snapshot.lap[2 * snapshot.capacity]).toBe(11);
    expect(snapshot.sessionTime[2 * snapshot.capacity]).toBe(990);
    // The live session number survives the restore.
    expect(snapshot.sessionNum).toBe(0);
    expect(publish).toHaveBeenCalledWith('lap-history.snapshot', snapshot);
  });

  it('keeps recording on top of restored history', async () => {
    const persistence = newPersistence({
      sessionNum: 0,
      apply: (target) => {
        writeCrossing(target, 0, 3, 270);
        return true;
      },
    });
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession());
    await settle();
    runtime.onFrame(frame({ sessionTime: 1000, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 1090, laps: [5] }));

    const snapshot = runtime.snapshot();
    expect(crossingCount(snapshot, 0)).toBe(2);
    expect(snapshot.lap[0]).toBe(3);
    expect(snapshot.lap[1]).toBe(4);
  });

  it('ignores stored history recorded in a different session number', async () => {
    const persistence = newPersistence({
      sessionNum: 1,
      apply: (target) => {
        writeCrossing(target, 0, 3, 270);
        return true;
      },
    });
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession());
    await settle();
    runtime.onFrame(frame({ sessionNum: 2, sessionTime: 100, laps: [4] }));

    expect(crossingCount(runtime.snapshot(), 0)).toBe(0);
  });

  it('lets live crossings win over a slow disk read', async () => {
    const apply = vi.fn(() => true);
    const persistence = newPersistence({ sessionNum: 0, apply });
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession());
    // Frames arrive and record before the read resolves.
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    await settle();
    runtime.onFrame(frame({ sessionTime: 280, laps: [6] }));

    expect(apply).not.toHaveBeenCalled();
    expect(crossingCount(runtime.snapshot(), 0)).toBe(2);
  });

  it('drops a stored read that resolves after a newer session started', async () => {
    const apply = vi.fn(() => true);
    let resolveFirst: (value: StoredLapHistory | null) => void = () => {
      /* replaced below */
    };
    const persistence: LapHistoryPersistence = {
      save: vi.fn(),
      load: vi.fn((sessionId: string) =>
        sessionId === '111'
          ? new Promise<StoredLapHistory | null>((resolve) => {
              resolveFirst = resolve;
            })
          : Promise.resolve(null)
      ),
    };
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession(111));
    runtime.onSession(raceSession(222));
    resolveFirst({ sessionNum: 0, apply });
    await settle();
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));

    expect(apply).not.toHaveBeenCalled();
    expect(runtime.getCurrentSessionId()).toBe('222');
  });

  it('does not persist while a read for the same session is still in flight', () => {
    const persistence: LapHistoryPersistence = {
      save: vi.fn(),
      load: vi.fn(() => new Promise<StoredLapHistory | null>(() => undefined)),
    };
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );

    runtime.onSession(raceSession());
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));

    expect(crossingCount(runtime.snapshot(), 0)).toBe(1);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('stops aggregating during a replay and resumes when live', async () => {
    const lifecycle = createSessionLifecycle();
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      lifecycle,
      newMetrics(),
      newPersistence()
    );
    runtime.onSession(raceSession());
    await settle();

    lifecycle._onEnter({ replay: true });
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(crossingCount(runtime.snapshot(), 0)).toBe(0);

    lifecycle._onEnter({ replay: false });
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(crossingCount(runtime.snapshot(), 0)).toBe(1);
  });

  it('clears the session id and recorded laps on disconnect', async () => {
    const lifecycle = createSessionLifecycle();
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      lifecycle,
      newMetrics(),
      newPersistence()
    );
    runtime.onSession(raceSession(555));
    await settle();
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));
    runtime.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(runtime.getCurrentSessionId()).toBe('555');

    lifecycle._onDisconnect();

    expect(runtime.getCurrentSessionId()).toBe('');
    expect(crossingCount(runtime.snapshot(), 0)).toBe(0);
  });

  it('re-baselines when the Gantry is enabled mid-session', async () => {
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      createSessionLifecycle(),
      newMetrics(),
      newPersistence()
    );
    runtime.onSession(raceSession());
    await settle();
    runtime.updateEnabled(false);
    runtime.onFrame(frame({ sessionTime: 100, laps: [4] }));

    runtime.updateEnabled(true);
    // Lap 9 is the first seen since enabling, so it only sets the baseline.
    runtime.onFrame(frame({ sessionTime: 900, laps: [9] }));
    expect(crossingCount(runtime.snapshot(), 0)).toBe(0);

    runtime.onFrame(frame({ sessionTime: 990, laps: [10] }));
    expect(crossingCount(runtime.snapshot(), 0)).toBe(1);
    expect(runtime.snapshot().lap[0]).toBe(9);
  });

  it('disposes lifecycle subscriptions so later events no longer reach it', async () => {
    const lifecycle = createSessionLifecycle();
    const runtime = new LapHistoryRuntime(
      new ChannelBus(),
      lifecycle,
      newMetrics(),
      newPersistence()
    );
    runtime.onSession(raceSession(42));
    await settle();
    expect(runtime.getCurrentSessionId()).toBe('42');

    runtime.dispose();
    lifecycle._onDisconnect();

    expect(runtime.getCurrentSessionId()).toBe('42');
  });
});
