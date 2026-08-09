import { describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  Session,
  Telemetry,
} from '@irdashies/types';
import { CHANNEL_DELIVERY, ChannelBus } from './app/bridge/channelBridge';
import { createDefaultProcessorHost } from './app/processors/processorRegistry';
import type { ProcessorHost } from './app/processors/ProcessorHost';
import { createSessionLifecycle } from './app/sessionLifecycle';
import type { SessionLifecycle } from './app/sessionLifecycle';
import {
  ChannelSelectionStore,
  ChannelSnapshotStore,
} from './frontend/context/ChannelStore/ChannelSnapshotStore';

const SNAPSHOT_CHANNELS = [
  'blind-spot.snapshot',
  'car-speeds.snapshot',
  'driver-controls.snapshot',
  'fuel.projection',
  'lap-times.snapshot',
  'lap-log.snapshot',
  'reference-laps.snapshot',
  'radio.snapshot',
  'relative-gaps.snapshot',
  'sector-timing.snapshot',
  'session-timing.snapshot',
  'session-bar.snapshot',
  'standings.snapshot',
  'track-state.snapshot',
] as const satisfies readonly Exclude<ChannelName, 'session.lifecycle'>[];

type SnapshotChannel = (typeof SNAPSHOT_CHANNELS)[number];
type SourceKind = 'live-tape' | 'mock';
type MissingSnapshotChannel = Exclude<
  Exclude<ChannelName, 'session.lifecycle'>,
  SnapshotChannel
>;
const ALL_SNAPSHOT_CHANNELS_ARE_COVERED: MissingSnapshotChannel extends never
  ? true
  : never = true;

interface ScheduledTask {
  readonly dueAt: number;
  readonly callback: () => void;
  cancelled: boolean;
}

class DeterministicClock {
  now = 0;
  private readonly tasks = new Set<ScheduledTask>();

  schedule = (callback: () => void, delayMs: number) => {
    const task: ScheduledTask = {
      dueAt: this.now + delayMs,
      callback,
      cancelled: false,
    };
    this.tasks.add(task);
    return {
      cancel: () => {
        task.cancelled = true;
        this.tasks.delete(task);
      },
    };
  };

  advanceTo(milliseconds: number): void {
    this.now = milliseconds;
    let due = this.nextDue();
    while (due) {
      this.tasks.delete(due);
      if (!due.cancelled) due.callback();
      due = this.nextDue();
    }
  }

  private nextDue(): ScheduledTask | undefined {
    return [...this.tasks]
      .filter((task) => !task.cancelled && task.dueAt <= this.now)
      .sort((left, right) => left.dueAt - right.dueAt)[0];
  }
}

type ChannelCallback = (payload: ChannelPayloads[ChannelName]) => void;

/** Test equivalent of the preload bridge's local subscription aggregation. */
class InMemoryRendererBridge implements ChannelBridge {
  private readonly callbacks = new Map<ChannelName, Set<ChannelCallback>>();
  private visible = true;
  private destroyed = false;
  private readonly target: {
    id: number;
    isDestroyed: () => boolean;
    isVisible: () => boolean;
    send: (deliveryChannel: string, channel: string, payload: unknown) => void;
  };

  constructor(
    private readonly bus: ChannelBus,
    private readonly rendererId: number
  ) {
    this.target = {
      id: rendererId,
      isDestroyed: () => this.destroyed,
      isVisible: () => this.visible,
      send: (deliveryChannel, channel, payload) => {
        if (deliveryChannel !== CHANNEL_DELIVERY) return;
        const callbacks = this.callbacks.get(channel as ChannelName);
        callbacks?.forEach((callback) =>
          callback(payload as ChannelPayloads[ChannelName])
        );
      },
    };
  }

  subscribe<K extends ChannelName>(
    channel: K,
    callback: (payload: ChannelPayloads[K]) => void,
    requestedRateHz?: number
  ): () => void {
    let callbacks = this.callbacks.get(channel);
    if (!callbacks) {
      callbacks = new Set();
      this.callbacks.set(channel, callbacks);
      callbacks.add(callback as ChannelCallback);
      this.bus.subscribe(this.target, channel, requestedRateHz);
    } else {
      callbacks.add(callback as ChannelCallback);
    }
    return () => {
      callbacks?.delete(callback as ChannelCallback);
      if (callbacks?.size === 0) {
        this.callbacks.delete(channel);
        this.bus.unsubscribe(this.rendererId, channel);
      }
    };
  }

  hide(): void {
    this.visible = false;
    this.bus.rendererBecameHidden(this.rendererId);
  }

  show(): void {
    this.visible = true;
    this.bus.rendererBecameVisible(this.rendererId);
  }

  dispose(): void {
    this.destroyed = true;
    this.callbacks.clear();
    this.bus.removeRenderer(this.rendererId);
  }
}

class SyntheticSourceAdapter {
  private eventTime = 0;

  constructor(
    private readonly kind: SourceKind,
    private readonly clock: DeterministicClock,
    private readonly lifecycle: SessionLifecycle,
    private host: ProcessorHost
  ) {}

  replaceHost(host: ProcessorHost): void {
    this.host = host;
  }

  enter(): void {
    this.advance();
    this.lifecycle._onEnter({ replay: this.kind === 'live-tape' });
  }

  session(value: Session): void {
    this.advance();
    this.lifecycle._onSession(value);
    this.host.onSession(value);
  }

  frame(value: Telemetry): void {
    const sessionTime = value.SessionTime?.value?.[0];
    this.eventTime =
      typeof sessionTime === 'number'
        ? Math.max(this.eventTime + 0.25, sessionTime)
        : this.eventTime + 0.25;
    this.clock.advanceTo(this.eventTime * 1000);
    this.lifecycle._onTelemetry(value);
    this.host.onFrame(value);
  }

  disconnect(): void {
    this.advance();
    this.lifecycle._onDisconnect();
  }

  flush(): void {
    this.eventTime += 1;
    this.clock.advanceTo(this.eventTime * 1000);
  }

  private advance(): void {
    this.eventTime += 0.25;
    this.clock.advanceTo(this.eventTime * 1000);
  }
}

interface RendererStores {
  readonly stores: Map<
    SnapshotChannel,
    ChannelSelectionStore<SnapshotChannel, ChannelPayloads[SnapshotChannel]>
  >;
  readonly changes: Map<SnapshotChannel, ReturnType<typeof vi.fn>>;
  snapshot<K extends SnapshotChannel>(
    channel: K
  ): ChannelPayloads[K] | undefined;
  dispose(): void;
}

const attachStores = (
  bridge: ChannelBridge,
  channels: readonly SnapshotChannel[] = SNAPSHOT_CHANNELS
): RendererStores => {
  const stores = new Map<
    SnapshotChannel,
    ChannelSelectionStore<SnapshotChannel, ChannelPayloads[SnapshotChannel]>
  >();
  const changes = new Map<SnapshotChannel, ReturnType<typeof vi.fn>>();
  const unsubscribes: (() => void)[] = [];
  for (const channel of channels) {
    const store = new ChannelSnapshotStore(channel, bridge);
    const selection = store.createSelection((snapshot) => snapshot);
    const listener = vi.fn();
    stores.set(channel, selection);
    changes.set(channel, listener);
    unsubscribes.push(selection.subscribe(listener));
  }
  return {
    stores,
    changes,
    snapshot: <K extends SnapshotChannel>(channel: K) =>
      stores.get(channel)?.getSnapshot() as ChannelPayloads[K] | undefined,
    dispose: () =>
      unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe()),
  };
};

const session = (sessionNum = 1): Session =>
  ({
    WeekendInfo: {
      SeriesID: 7,
      TrackID: 9,
      TrackName: 'synthetic-track',
      TrackDisplayName: 'Synthetic Raceway',
      TrackLength: '1 km',
      WeekendOptions: { IncidentLimit: 17 },
    },
    DriverInfo: {
      DriverCarIdx: 0,
      PaceCarIdx: -1,
      DriverCarFuelMaxLtr: 50,
      DriverCarMaxFuelPct: 1,
      DriverCarSLShiftRPM: 7000,
      DriverCarSLBlinkRPM: 7500,
      Drivers: [
        {
          CarIdx: 0,
          CarID: 101,
          CarPath: 'synthetic/player',
          CarClassID: 10,
          CarClassEstLapTime: 60,
        },
        {
          CarIdx: 1,
          CarID: 202,
          CarPath: 'synthetic/rival',
          CarClassID: 10,
          CarClassEstLapTime: 61,
        },
      ],
    },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: sessionNum,
          SessionName: 'Race',
          SessionType: 'Race',
          SessionLaps: 10,
          ResultsPositions: [
            { CarIdx: 0, Position: 1, ClassPosition: 0, LapsComplete: 1 },
            { CarIdx: 1, Position: 2, ClassPosition: 1, LapsComplete: 1 },
          ],
        },
      ],
    },
    SplitTimeInfo: {
      Sectors: [
        { SectorNum: 0, SectorStartPct: 0 },
        { SectorNum: 1, SectorStartPct: 0.5 },
      ],
    },
  }) as unknown as Session;

interface FrameOptions {
  readonly time: number;
  readonly sessionNum?: number;
  readonly lap?: number;
  readonly lapPct?: number;
  readonly rivalPct?: number;
  readonly fuel?: number;
  readonly radio?: readonly number[];
  readonly throttle?: number;
}

const frame = ({
  time,
  sessionNum = 1,
  lap = 1,
  lapPct = 0.1,
  rivalPct = lapPct + 0.05,
  fuel = 40,
  radio = [1, -1],
  throttle = 0.7,
}: FrameOptions): Telemetry => {
  const values: Record<string, unknown> = {
    SessionTime: time,
    SessionNum: sessionNum,
    SessionState: 4,
    SessionTimeTotal: 600,
    SessionTimeRemain: 500 - time,
    SessionLapsRemain: 10 - lap,
    SessionFlags: 0,
    SessionUniqueID: 7001,
    CamCarIdx: 0,
    CarIdxLapDistPct: [lapPct, rivalPct],
    CarIdxEstTime: [lapPct * 60, rivalPct * 61],
    CarIdxOnPitRoad: [false, false],
    CarIdxLap: [lap, lap],
    CarIdxLapCompleted: [lap - 1, lap - 1],
    CarIdxPosition: [1, 2],
    CarIdxClassPosition: [1, 2],
    CarIdxBestLapTime: [60, 61],
    CarIdxLastLapTime: lap > 1 ? [60, 61] : [0, 0],
    CarIdxF2Time: [0, 1.1],
    CarIdxTrackSurface: [3, 3],
    CarIdxTireCompound: [1, 1],
    CarIdxSessionFlags: [0, 0],
    CarIdxP2PStatus: [false, false],
    CarIdxP2PCount: [0, 0],
    CarIdxClass: [10, 10],
    RadioTransmitCarIdx: radio,
    FuelLevel: fuel,
    FuelLevelPct: fuel / 50,
    Lap: lap,
    LapCompleted: lap - 1,
    LapDistPct: lapPct,
    LapCurrentLapTime: time,
    LapLastLapTime: lap > 1 ? 60 : 0,
    LapBestLapTime: 60,
    LapDeltaToSessionLastLap: -0.1,
    LapDeltaToSessionLastLap_OK: true,
    LapDeltaToSessionBestLap: 0.2,
    LapDeltaToSessionBestLap_OK: true,
    IsOnTrack: true,
    OnPitRoad: false,
    PlayerCarTowTime: 0,
    PlayerTrackSurface: 3,
    PlayerCarMyIncidentCount: 2,
    PlayerCarTeamIncidentCount: 2,
    Speed: 50,
    DisplayUnits: 1,
    Brake: 0.1,
    BrakeRaw: 0.11,
    Throttle: throttle,
    ThrottleRaw: throttle,
    Clutch: 0,
    ClutchRaw: 0,
    Gear: 4,
    SteeringWheelAngle: 0.05,
    BrakeABSactive: false,
    RPM: 6500,
    ShiftGrindRPM: 0,
    OilTemp: 100,
    WaterTemp: 90,
    EngineWarnings: 0,
    CarLeftRight: 0,
    PlayerCarInPitStall: false,
    IsInGarage: false,
    IsGarageVisible: false,
    IsReplayPlaying: false,
    PitSpeedLimiterToggle: false,
    PitstopActive: false,
    TrackWetness: 0,
    WeatherDeclaredWet: false,
    AirTemp: 20,
    TrackTemp: 25,
    RelativeHumidity: 50,
    WindDir: 0,
    WindVel: 2,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      { value: Array.isArray(value) ? value : [value] },
    ])
  ) as unknown as Telemetry;
};

const createHarness = (kind: SourceKind, rendererId = 1) => {
  const clock = new DeterministicClock();
  const bus = new ChannelBus({
    now: () => clock.now,
    schedule: clock.schedule,
  });
  const lifecycle = createSessionLifecycle();
  const host = createDefaultProcessorHost({
    bus,
    lifecycle,
    metrics: { markStart: () => undefined, markEnd: () => undefined },
    aggregateReplay: kind === 'live-tape',
    referenceLapPersistence: { load: () => null, save: () => undefined },
  });
  const bridge = new InMemoryRendererBridge(bus, rendererId);
  const source = new SyntheticSourceAdapter(kind, clock, lifecycle, host);
  return { bus, bridge, clock, host, lifecycle, source };
};

const playBaseline = (source: SyntheticSourceAdapter): void => {
  source.enter();
  source.session(session());
  source.frame(frame({ time: 1, lapPct: 0.1, fuel: 40 }));
  source.frame(frame({ time: 1.25, lapPct: 0.12, fuel: 39.8 }));
  source.frame(frame({ time: 1.5, lapPct: 0.14, fuel: 39.6 }));
  source.frame(frame({ time: 1.75, lapPct: 0.16, fuel: 39.4, throttle: 0.8 }));
  source.frame(frame({ time: 2, lapPct: 0.18, fuel: 39.2, radio: [0, -1] }));
  source.flush();
};

type SnapshotRecord = {
  [K in SnapshotChannel]: ChannelPayloads[K];
};

const snapshotRecord = (stores: RendererStores): SnapshotRecord =>
  Object.fromEntries(
    SNAPSHOT_CHANNELS.map((channel) => {
      const snapshot = stores.snapshot(channel);
      if (!snapshot) throw new Error(`Missing ${channel} snapshot`);
      return [channel, structuredClone(snapshot)];
    })
  ) as SnapshotRecord;

const summarize = (snapshots: SnapshotRecord) => ({
  'car-speeds.snapshot': {
    sessionNum: snapshots['car-speeds.snapshot'].sessionNum,
    carSpeeds: snapshots['car-speeds.snapshot'].carSpeeds,
    version: snapshots['car-speeds.snapshot'].version,
  },
  'driver-controls.snapshot': {
    throttle: snapshots['driver-controls.snapshot'].throttle,
    gear: snapshots['driver-controls.snapshot'].gear,
    rpm: snapshots['driver-controls.snapshot'].rpm,
    shiftRpm: snapshots['driver-controls.snapshot'].shiftRpm,
    version: snapshots['driver-controls.snapshot'].version,
  },
  'fuel.projection': {
    isReplay: snapshots['fuel.projection'].isReplay,
    fuelLevel: snapshots['fuel.projection'].fuelLevel,
    currentLap: snapshots['fuel.projection'].currentLap,
    sessionNum: snapshots['fuel.projection'].sessionNum,
    sessionType: snapshots['fuel.projection'].sessionType,
  },
  'lap-times.snapshot': {
    lapTimes: snapshots['lap-times.snapshot'].lapTimes,
    sessionNum: snapshots['lap-times.snapshot'].sessionNum,
    version: snapshots['lap-times.snapshot'].version,
  },
  'lap-log.snapshot': {
    lapCompleted: snapshots['lap-log.snapshot'].lapCompleted,
    incidentCount: snapshots['lap-log.snapshot'].incidentCount,
    sessionNum: snapshots['lap-log.snapshot'].sessionNum,
    version: snapshots['lap-log.snapshot'].version,
  },
  'reference-laps.snapshot': {
    bestLapCount: snapshots['reference-laps.snapshot'].bestLaps.length,
    persistedLapCount:
      snapshots['reference-laps.snapshot'].persistedLaps.length,
    sessionNum: snapshots['reference-laps.snapshot'].sessionNum,
    version: snapshots['reference-laps.snapshot'].version,
  },
  'radio.snapshot': {
    transmittingCarIdxs: snapshots['radio.snapshot'].transmittingCarIdxs,
    version: snapshots['radio.snapshot'].version,
  },
  'relative-gaps.snapshot': {
    focusCarIdx: snapshots['relative-gaps.snapshot'].focusCarIdx,
    relativePcts: snapshots['relative-gaps.snapshot'].relativePcts,
    sessionNum: snapshots['relative-gaps.snapshot'].sessionNum,
    version: snapshots['relative-gaps.snapshot'].version,
  },
  'sector-timing.snapshot': {
    sectorCount: snapshots['sector-timing.snapshot'].sectors.length,
    currentSectorIdx: snapshots['sector-timing.snapshot'].currentSectorIdx,
    sessionNum: snapshots['sector-timing.snapshot'].sessionNum,
    version: snapshots['sector-timing.snapshot'].version,
  },
  'session-timing.snapshot': {
    sessionType: snapshots['session-timing.snapshot'].sessionType,
    currentLap: snapshots['session-timing.snapshot'].currentLap,
    totalLaps: snapshots['session-timing.snapshot'].totalLaps,
    sessionNum: snapshots['session-timing.snapshot'].sessionNum,
    version: snapshots['session-timing.snapshot'].version,
  },
  'session-bar.snapshot': {
    sessionName: snapshots['session-bar.snapshot'].sessionName,
    playerOverallPosition:
      snapshots['session-bar.snapshot'].playerOverallPosition,
    sessionNum: snapshots['session-bar.snapshot'].sessionNum,
    version: snapshots['session-bar.snapshot'].version,
  },
  'standings.snapshot': {
    focusCarIdx: snapshots['standings.snapshot'].focusCarIdx,
    carIdxPosition: snapshots['standings.snapshot'].carIdxPosition,
    liveClassPosition: snapshots['standings.snapshot'].liveClassPosition,
    sessionNum: snapshots['standings.snapshot'].sessionNum,
    version: snapshots['standings.snapshot'].version,
  },
  'track-state.snapshot': {
    focusCarIdx: snapshots['track-state.snapshot'].focusCarIdx,
    lapDistPct: snapshots['track-state.snapshot'].lapDistPct,
    speed: snapshots['track-state.snapshot'].speed,
    sessionNum: snapshots['track-state.snapshot'].sessionNum,
    version: snapshots['track-state.snapshot'].version,
  },
});

describe('runtime boundary replay', () => {
  it('matches a fixed golden across all 13 live-tape and mock snapshots', () => {
    const run = (kind: SourceKind, rendererId: number) => {
      const harness = createHarness(kind, rendererId);
      const stores = attachStores(harness.bridge);
      playBaseline(harness.source);
      const result = snapshotRecord(stores);
      stores.dispose();
      harness.host.dispose();
      harness.bus.dispose();
      return result;
    };

    const tape = run('live-tape', 1);
    const mock = run('mock', 2);
    expect(ALL_SNAPSHOT_CHANNELS_ARE_COVERED).toBe(true);
    expect(tape['fuel.projection'].isReplay).toBe(true);
    expect(mock['fuel.projection'].isReplay).toBe(false);
    expect({
      ...tape,
      'fuel.projection': { ...tape['fuel.projection'], isReplay: false },
    }).toEqual(mock);

    // This literal is intentionally maintained by hand. There is no update
    // mode or generated snapshot file that can silently accept contract drift.
    expect(summarize(mock)).toEqual(FIXED_GOLDEN);
  });

  it('clears stale data across visibility, churn, lifecycle, and host restart', () => {
    const harness = createHarness('mock');
    const stores = attachStores(harness.bridge);
    playBaseline(harness.source);

    const lateBridge = new InMemoryRendererBridge(harness.bus, 2);
    const lateStores = attachStores(lateBridge, ['fuel.projection']);
    expect(lateStores.snapshot('fuel.projection')?.fuelLevel).toBe(39.2);

    harness.bridge.hide();
    lateBridge.hide();
    const hiddenChanges = Object.fromEntries(
      [...stores.changes].map(([channel, listener]) => [
        channel,
        listener.mock.calls.length,
      ])
    );
    harness.source.frame(
      frame({ time: 4, lapPct: 0.4, fuel: 35, throttle: 0.2 })
    );
    expect(
      Object.fromEntries(
        [...stores.changes].map(([channel, listener]) => [
          channel,
          listener.mock.calls.length,
        ])
      )
    ).toEqual(hiddenChanges);
    harness.bridge.show();
    harness.source.frame(
      frame({ time: 4.25, lapPct: 0.42, fuel: 34.8, throttle: 0.3 })
    );
    expect(stores.snapshot('fuel.projection')?.fuelLevel).toBe(34.8);

    lateStores.dispose();
    const churnBridge = new InMemoryRendererBridge(harness.bus, 3);
    const churnStore = attachStores(churnBridge, ['radio.snapshot']);
    expect(churnStore.snapshot('radio.snapshot')?.transmittingCarIdxs).toEqual([
      1,
    ]);
    churnStore.dispose();

    harness.source.frame(
      frame({ time: 4.5, lapPct: 0.44, fuel: 34.6, radio: [1, -1] })
    );
    const resubscribed = attachStores(churnBridge, ['radio.snapshot']);
    expect(
      resubscribed.snapshot('radio.snapshot')?.transmittingCarIdxs
    ).toEqual([1]);

    harness.source.frame(frame({ time: 5, sessionNum: 2 }));
    harness.source.session(session(2));
    harness.source.frame(
      frame({ time: 5.25, sessionNum: 2, lapPct: 0.2, fuel: 30 })
    );
    expect(stores.snapshot('car-speeds.snapshot')?.sessionNum).toBe(2);

    harness.source.disconnect();
    harness.source.enter();
    harness.source.session(session(2));
    harness.source.frame(
      frame({ time: 6.5, sessionNum: 2, lapPct: 0.3, fuel: 29 })
    );
    expect(stores.snapshot('fuel.projection')?.fuelLevel).toBe(29);

    harness.host.dispose();
    const restartedHost = createDefaultProcessorHost({
      bus: harness.bus,
      lifecycle: harness.lifecycle,
      metrics: { markStart: () => undefined, markEnd: () => undefined },
      referenceLapPersistence: { load: () => null, save: () => undefined },
    });
    harness.source.replaceHost(restartedHost);
    const postRestartBridge = new InMemoryRendererBridge(harness.bus, 4);
    const postRestartStore = attachStores(postRestartBridge, [
      'fuel.projection',
    ]);
    expect(postRestartStore.snapshot('fuel.projection')).toMatchObject({
      fuelLevel: 0,
      sessionNum: 0,
    });
    expect(postRestartStore.snapshot('fuel.projection')?.fuelLevel).not.toBe(
      29
    );
    expect(harness.bus.metricsSnapshot().deliveries['4:fuel.projection']).toBe(
      1
    );

    harness.source.enter();
    harness.source.session(session(3));
    harness.source.frame(
      frame({ time: 8, sessionNum: 3, lapPct: 0.1, fuel: 25 })
    );
    harness.source.flush();
    expect(postRestartStore.snapshot('fuel.projection')?.fuelLevel).toBe(25);
    expect(postRestartStore.snapshot('fuel.projection')?.sessionNum).toBe(3);

    postRestartStore.dispose();
    resubscribed.dispose();
    stores.dispose();
    lateBridge.dispose();
    churnBridge.dispose();
    postRestartBridge.dispose();
    harness.bridge.dispose();
    restartedHost.dispose();
    harness.bus.dispose();
  });
});

const FIXED_GOLDEN = {
  'car-speeds.snapshot': {
    sessionNum: 1,
    carSpeeds: [288, 288],
    version: 6,
  },
  'driver-controls.snapshot': {
    throttle: 0.7,
    gear: 4,
    rpm: 6500,
    shiftRpm: 7000,
    version: 4,
  },
  'fuel.projection': {
    isReplay: false,
    fuelLevel: 39.2,
    currentLap: 1,
    sessionNum: 1,
    sessionType: 'Race',
  },
  'lap-times.snapshot': {
    lapTimes: [0, 0],
    sessionNum: 1,
    version: 2,
  },
  'lap-log.snapshot': {
    lapCompleted: 0,
    incidentCount: 2,
    sessionNum: 1,
    version: 5,
  },
  'reference-laps.snapshot': {
    bestLapCount: 0,
    persistedLapCount: 0,
    sessionNum: null,
    version: 2,
  },
  'radio.snapshot': {
    transmittingCarIdxs: [0],
    version: 2,
  },
  'relative-gaps.snapshot': {
    focusCarIdx: 0,
    relativePcts: [0, 0.04999999999999999],
    sessionNum: 1,
    version: 6,
  },
  'sector-timing.snapshot': {
    sectorCount: 2,
    currentSectorIdx: 0,
    sessionNum: 1,
    version: 3,
  },
  'session-timing.snapshot': {
    sessionType: 'Race',
    currentLap: 1,
    totalLaps: 10,
    sessionNum: 1,
    version: 5,
  },
  'session-bar.snapshot': {
    sessionName: 'Race',
    playerOverallPosition: 1,
    sessionNum: 1,
    version: 5,
  },
  'standings.snapshot': {
    focusCarIdx: 0,
    carIdxPosition: [1, 2],
    liveClassPosition: [2, 1],
    sessionNum: 1,
    version: 5,
  },
  'track-state.snapshot': {
    focusCarIdx: 0,
    lapDistPct: 0.18,
    speed: 50,
    sessionNum: 1,
    version: 5,
  },
} satisfies ReturnType<typeof summarize>;
