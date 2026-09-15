import { useEffect, useState } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import {
  LiveChannelBridgeDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import { useLapTraceStore } from '@irdashies/context';
import { hydrateLapTrace } from '../../domain/lapTrace/hydrateLapTrace';
import { parseGarage61Csv } from '../../domain/lapTrace/garage61CsvImport';
import {
  sampleGarage61Csv,
  sampleGarage61FileName,
} from '../../domain/lapTrace/fixtures/sampleGarage61Csv';
import { LapTrace, type LapTraceProps } from './LapTrace';
import { makeSyntheticLapTrace } from './fixtures/syntheticLap';

/**
 * The repo's test-data fixtures are single-frame snapshots, so there is no
 * recorded lap to load — these stories seed the store with a synthetic lap and
 * pin the car to a specific point on track. The Animated story instead uses the
 * no-path decorator, whose mock generator advances LapDistPct each tick.
 */

const TRACK_LENGTH_M = 5000;

const seedReference = () => {
  const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
  useLapTraceStore.setState({
    trackId: record.trackId,
    trackConfigName: record.trackConfigName,
    carPath: record.carPath,
    trackLengthM: record.trackLengthM,
    referenceLap: hydrateLapTrace(record),
    referenceError: null,
  });
};

/** Parses the shared Garage 61 fixture directly, without touching Electron IPC. */
const seedGarage61Reference = () => {
  const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
  if (!result.ok) throw new Error(result.message);
  useLapTraceStore.setState({
    referenceLap: hydrateLapTrace(result.record),
    referenceError: null,
  });
};

const clearReference = (referenceError: string | null = null) => {
  const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
  useLapTraceStore.setState({
    trackId: record.trackId,
    trackLengthM: record.trackLengthM,
    referenceLap: null,
    referenceError,
  });
};

export default {
  component: LapTrace,
  title: 'widgets/LapTrace',
  args: {
    metersBehind: 200,
    metersAhead: 200,
    showThrottle: true,
    showBrake: true,
    showSpeed: true,
    showGearLabels: true,
    showBrakePointMarkers: true,
    showThrottlePointMarkers: true,
    showGhost: true,
    ghostOpacity: 1,
    referenceFilled: false,
    strokeWidth: 3,
    showOnlyWhenOnTrack: false,
    background: { opacity: 0.7 },
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] h-[130px]">
        <Story />
      </div>
    ),
    TelemetryDecorator('/test-data/1735296198162'),
    // Every story needs a channel bridge, not just the animated one: the widget
    // reads its driving state from track-state.snapshot, and with no bridge the
    // channel store throws on an undefined WeakMap key. A decorator always
    // wraps the story, so its body sets window.channelBridge before the widget
    // renders.
    LiveChannelBridgeDecorator(),
  ],
} as Meta;

type Story = StoryObj<typeof LapTrace>;

/** Hard braking into the first corner of the synthetic lap. */
export const BrakingZone: Story = {
  args: { carDistanceMOverride: 340 },
  loaders: [async () => (seedReference(), {})],
};

/** At the apex, back on the power. */
export const MidCorner: Story = {
  args: { carDistanceMOverride: 405 },
  loaders: [async () => (seedReference(), {})],
};

/** Flat out between corners. */
export const OnTheStraight: Story = {
  args: { carDistanceMOverride: 800 },
  loaders: [async () => (seedReference(), {})],
};

/**
 * The seam case: the window straddles start/finish, so the right half shows the
 * beginning of the lap. The trace must run continuously through it.
 */
export const AcrossStartFinish: Story = {
  args: { carDistanceMOverride: TRACK_LENGTH_M - 20 },
  loaders: [async () => (seedReference(), {})],
};

/**
 * Sitting exactly on the reference lap's first braking point. The marker is at
 * its interpolated sub-metre position between two samples.
 */
export const OnTheBrakePoint: Story = {
  args: {
    carDistanceMOverride:
      hydrateLapTrace(makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M }))
        .events.brakeOnM[0] ?? 340,
  },
  loaders: [async () => (seedReference(), {})],
};

/** Application-point markers turned off entirely, trace only. */
export const NoEventMarkers: Story = {
  args: {
    carDistanceMOverride: 340,
    showBrakePointMarkers: false,
    showThrottlePointMarkers: false,
  },
  loaders: [async () => (seedReference(), {})],
};

/** Brake points only — a driver working purely on braking. */
export const BrakePointsOnly: Story = {
  args: { carDistanceMOverride: 340, showThrottlePointMarkers: false },
  loaders: [async () => (seedReference(), {})],
};

/** Throttle points only. */
export const ThrottlePointsOnly: Story = {
  args: { carDistanceMOverride: 340, showBrakePointMarkers: false },
  loaders: [async () => (seedReference(), {})],
};

/** A narrow window for a small overlay. */
export const NarrowWindow: Story = {
  args: { carDistanceMOverride: 340, metersBehind: 100, metersAhead: 100 },
  loaders: [async () => (seedReference(), {})],
};

/**
 * An uneven split: more track ahead than behind, so the car sits well to the
 * left instead of at the midpoint.
 */
export const AsymmetricWindow: Story = {
  args: { carDistanceMOverride: 340, metersBehind: 100, metersAhead: 600 },
  loaders: [async () => (seedReference(), {})],
};

/** Reference only, no live ghost. */
export const NoGhost: Story = {
  args: { carDistanceMOverride: 340, showGhost: false },
  loaders: [async () => (seedReference(), {})],
};

/** Pedals only. */
export const PedalsOnly: Story = {
  args: {
    carDistanceMOverride: 340,
    showSpeed: false,
    showGearLabels: false,
  },
  loaders: [async () => (seedReference(), {})],
};

/** Reference throttle/brake drawn as filled bars down to the axis, instead of a line. */
export const ReferenceFilled: Story = {
  args: { carDistanceMOverride: 340, referenceFilled: true },
  loaders: [async () => (seedReference(), {})],
};

/**
 * Follows the mock generator's simulated lap position, so the window scrolls.
 * Uses the no-path decorator because a test-data path freezes telemetry; the
 * channel bridge comes from the meta decorators, which republish whichever
 * telemetry stream is feeding the store.
 */
export const Animated: Story = {
  decorators: [TelemetryDecorator()],
  loaders: [async () => (seedReference(), {})],
};

/**
 * Feeds the driven-lap "ghost" independently of the reference, the way the
 * real recorder does as the car moves. Rather than wiring up the full
 * useLapTraceRecorder (which needs a live session/telemetry subscription and
 * would race with seedReference on every re-init), this calls the store's own
 * collectPlayerFrame directly on an interval with a synthetic driver profile —
 * same effect, no telemetry plumbing needed for a story.
 *
 * The driven lap brakes earlier and carries less apex speed into turn 1 than
 * the reference, so the bright ghost visibly lags the pastel reference through
 * the braking zone instead of tracing over it.
 */
const DRIVER_TOP_SPEED_MS = 75;
const DRIVER_ACCEL = 5;
const DRIVER_DECEL = 9;
const DRIVER_GEAR_COUNT = 6;
const DRIVER_CORNERS = [
  { apexM: 385, apexSpeedMs: 26 },
  { apexM: 1100, apexSpeedMs: 45 },
];

function driverSpeedAt(distanceM: number, trackLengthM: number): number {
  let v = DRIVER_TOP_SPEED_MS;
  for (const { apexM, apexSpeedMs } of DRIVER_CORNERS) {
    let delta = distanceM - apexM;
    if (delta > trackLengthM / 2) delta -= trackLengthM;
    if (delta < -trackLengthM / 2) delta += trackLengthM;
    const candidate =
      delta <= 0
        ? Math.sqrt(apexSpeedMs ** 2 + 2 * DRIVER_DECEL * -delta)
        : Math.sqrt(apexSpeedMs ** 2 + 2 * DRIVER_ACCEL * delta);
    if (candidate < v) v = candidate;
  }
  return Math.min(v, DRIVER_TOP_SPEED_MS);
}

function driverFrameAt(distanceM: number, trackLengthM: number) {
  const v = driverSpeedAt(distanceM, trackLengthM);
  const vNext = driverSpeedAt((distanceM + 1) % trackLengthM, trackLengthM);
  const rate = (vNext - v) * v; // dv/dt from dv/ds over a 1m step
  return {
    speedMs: v,
    throttle: rate > 0 ? Math.min(1, rate / DRIVER_ACCEL) : 0,
    brake: rate < 0 ? Math.min(1, -rate / DRIVER_DECEL) : 0,
    gear: Math.max(
      1,
      Math.min(
        DRIVER_GEAR_COUNT,
        1 + Math.floor((v / DRIVER_TOP_SPEED_MS) * DRIVER_GEAR_COUNT)
      )
    ),
  };
}

const DEMO_TRACK_ID = 1;
const DEMO_CAR_PATH = 'syntheticcar';
const DEMO_LOOP_START_M = 100;
const DEMO_LOOP_END_M = 900;
const DEMO_SPEED_MS = 40;
const DEMO_TICK_MS = 50;

/** (Re)creates an empty active lap and the static reference, in that order so
 * initialize()'s referenceLap reset can't clobber the reference we just set. */
const seedDrivingGhost = async () => {
  await useLapTraceStore
    .getState()
    .initialize(undefined, DEMO_TRACK_ID, '', DEMO_CAR_PATH, TRACK_LENGTH_M);
  seedReference();
};

const DrivingGhostDemo = (props: LapTraceProps) => {
  const [carDistanceM, setCarDistanceM] = useState(DEMO_LOOP_START_M);

  useEffect(() => {
    let distanceM = DEMO_LOOP_START_M;
    let sessionTime = 0;
    let version = 0;

    const tick = () => {
      distanceM += (DEMO_SPEED_MS * DEMO_TICK_MS) / 1000;
      if (distanceM > DEMO_LOOP_END_M) {
        distanceM = DEMO_LOOP_START_M;
        sessionTime = 0;
        // Reset cleanly rather than letting collectPlayerFrame see a big
        // backward jump in lap distance, which would read as a bogus event.
        void seedDrivingGhost();
      }
      sessionTime += DEMO_TICK_MS / 1000;

      const { speedMs, throttle, brake, gear } = driverFrameAt(
        distanceM,
        TRACK_LENGTH_M
      );
      useLapTraceStore.getState().collectPlayerFrame(undefined, {
        sessionTime,
        lapDistPct: distanceM / TRACK_LENGTH_M,
        throttle,
        brake,
        speed: speedMs,
        gear,
        brakeAbsActive: false,
        onPitRoad: false,
        isOnTrack: true,
        sessionNum: 0,
        lastLapTime: 0,
        lapCompleted: 0,
        incidentCount: 0,
        version: ++version,
      });

      setCarDistanceM(distanceM);
    };

    const interval = setInterval(tick, DEMO_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return <LapTrace {...props} carDistanceMOverride={carDistanceM} />;
};

export const DrivingGhost: Story = {
  render: (args) => <DrivingGhostDemo {...args} />,
  loaders: [async () => (await seedDrivingGhost(), {})],
};

/**
 * The last-corner panel enabled, to check the height budget: three slots cost
 * real height in an already short widget, so the trace above still has to read
 * well. The slots stay blank here — they only fill once corners have actually
 * been driven and exited, which needs live track position.
 */
export const WithLastCornerPanel: Story = {
  args: {
    carDistanceMOverride: 340,
    showLastCorner: true,
    lastCornerCount: 3,
    lastCornerPosition: 'bottom',
  },
  loaders: [async () => (seedReference(), {})],
};

/**
 * The same panel stacked down the right-hand side. This is the placement that
 * costs the trace the most: the column takes a fixed width out of the plot, so
 * it suits a widget wider than the 396px default.
 */
export const LastCornerPanelOnTheSide: Story = {
  args: {
    carDistanceMOverride: 340,
    showLastCorner: true,
    lastCornerCount: 3,
    lastCornerPosition: 'right',
  },
  loaders: [async () => (seedReference(), {})],
};

/**
 * Everything switched on at once — gear labels, application markers, the
 * countdown bars and the last-corner panel — so the pieces can be checked for
 * space against each other rather than one at a time.
 *
 * Use the `lastCornerPosition` and `brakeCueBarSide` controls to move the
 * panels around, and the widget-size stories below for the tight cases.
 */
const everythingOn = {
  carDistanceMOverride: 340,
  showThrottle: true,
  showBrake: true,
  showSpeed: true,
  showGearLabels: true,
  showBrakePointMarkers: true,
  showThrottlePointMarkers: true,
  showGhost: true,
  referenceFilled: true,
  showLastCorner: true,
  lastCornerCount: 3,
  brakeCueBars: true,
  brakeCueBarSide: 'right' as const,
};

export const EverythingBottom: Story = {
  args: { ...everythingOn, lastCornerPosition: 'bottom' },
  loaders: [async () => (seedReference(), {})],
};

export const EverythingTop: Story = {
  args: { ...everythingOn, lastCornerPosition: 'top' },
  loaders: [async () => (seedReference(), {})],
};

/** Panel on the left, countdown bars still on the right. */
export const EverythingLeft: Story = {
  args: { ...everythingOn, lastCornerPosition: 'left' },
  loaders: [async () => (seedReference(), {})],
};

/**
 * Panel and bars sharing the right edge — the bars sit inboard, next to the
 * trace they are cueing.
 */
export const EverythingRight: Story = {
  args: { ...everythingOn, lastCornerPosition: 'right' },
  loaders: [async () => (seedReference(), {})],
};

/**
 * Everything on in a widget squeezed to half height, the case that used to push
 * the trace outside its own rectangle and slide the gear labels up into the
 * graph. The trace should shrink, the labels should stay under it, and nothing
 * should escape the box.
 */
export const EverythingShort: Story = {
  args: { ...everythingOn, lastCornerPosition: 'bottom' },
  decorators: [
    (Story) => (
      <div className="w-[420px] h-[70px] outline outline-1 outline-fuchsia-500/60">
        <Story />
      </div>
    ),
  ],
  loaders: [async () => (seedReference(), {})],
};

/**
 * The side placement at a width that actually suits it: each corner's name,
 * time and speed on one line.
 */
export const EverythingWide: Story = {
  args: { ...everythingOn, lastCornerPosition: 'right' },
  decorators: [
    (Story) => (
      <div className="w-[640px] h-[160px]">
        <Story />
      </div>
    ),
  ],
  loaders: [async () => (seedReference(), {})],
};

/**
 * The brake countdown strip enabled, to check it does not crowd the plot. The
 * bars stay hidden here — they only light as the car actually approaches one of
 * the reference lap's brake points, which needs live track position.
 */
export const WithBrakeCueBars: Story = {
  args: { carDistanceMOverride: 340, brakeCueBars: true },
  loaders: [async () => (seedReference(), {})],
};

/**
 * A real Garage 61 CSV export parsed end-to-end (parse -> hydrate -> render)
 * without touching Electron IPC — the same fixture the parser spec uses.
 */
export const Garage61Import: Story = {
  args: { carDistanceMOverride: 650, referenceSource: 'garage61' },
  loaders: [async () => (seedGarage61Reference(), {})],
};

/** Before a clean lap has been recorded. */
export const NoReferenceLap: Story = {
  loaders: [async () => (clearReference(), {})],
};

/** A source that is not implemented yet reports itself instead of blanking. */
export const SourceComingSoon: Story = {
  args: { referenceSource: 'manual' },
  loaders: [
    async () => (
      clearReference('Importing a saved .ibt lap is not available yet'),
      {}
    ),
  ],
};
