import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, type ComponentType } from 'react';
import { DashboardProvider } from '@irdashies/context';
import {
  ChannelSnapshotDecorator,
  TelemetryDecoratorWithConfig,
  createMockBridgeWithConfig,
  sessionBarStorySnapshot,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import type {
  CarConditionSnapshot,
  CarDynamicsSnapshot,
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  FuelLapData,
  FuelProjectionSnapshot,
  TrackStateSnapshot,
} from '@irdashies/types';
import {
  BrakePressure,
  CruiseOdometer,
  FrictionCircle,
  SteeringMeter,
  StintHistory,
  SuspensionPosition,
  TrackClock,
} from './DrivingMetrics';

type ChannelFrame = Partial<ChannelPayloads>;
type Listener = (payload: ChannelFrame[ChannelName]) => void;

const MovingChannelsDecorator = (
  frameAt: (elapsedSec: number) => ChannelFrame
): Decorator => {
  const listeners = new Map<ChannelName, Set<Listener>>();
  let latest = frameAt(0);
  const bridge: ChannelBridge = {
    subscribe: (channel, callback) => {
      const listener = callback as Listener;
      const set = listeners.get(channel) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(channel, set);
      const current = latest[channel];
      if (current !== undefined) listener(current);
      return () => {
        set.delete(listener);
      };
    },
  };

  const DecoratorComponent: Decorator = (Story) => {
    const previousBridge = useRef(window.channelBridge);
    window.channelBridge = bridge;
    useEffect(() => {
      const restore = previousBridge.current;
      const started = performance.now();
      const timer = setInterval(() => {
        latest = frameAt((performance.now() - started) / 1000);
        for (const [channel, set] of listeners) {
          const payload = latest[channel];
          if (payload === undefined) continue;
          for (const listener of set) listener(payload);
        }
      }, 50);
      return () => {
        clearInterval(timer);
        if (restore === undefined) {
          Reflect.deleteProperty(window, 'channelBridge');
        } else {
          window.channelBridge = restore;
        }
      };
    }, []);
    return <Story />;
  };
  return DecoratorComponent;
};

const lmuBridge = {
  ...createMockBridgeWithConfig({}),
  getActiveSimulator: async () => 'lmu' as const,
};

const LmuDecorator: Decorator = (Story) => (
  <DashboardProvider bridge={lmuBridge}>
    <Story />
  </DashboardProvider>
);

const sized =
  (width: number, height: number): Decorator =>
  (Story: ComponentType) => (
    <div style={{ width, height }}>
      <Story />
    </div>
  );

const trackState = (
  overrides: Partial<TrackStateSnapshot> = {}
): TrackStateSnapshot => ({ ...trackStateStorySnapshot, ...overrides });

const carDynamics = (
  overrides: Partial<CarDynamicsSnapshot>
): CarDynamicsSnapshot => ({ version: 1, ...overrides });

const carCondition = (
  overrides: Partial<CarConditionSnapshot>
): CarConditionSnapshot => ({ version: 1, ...overrides });

const lap = (
  lapNumber: number,
  lapTime: number,
  fuelUsed: number,
  extra: Partial<FuelLapData> = {}
): FuelLapData => ({
  lapNumber,
  lapTime,
  fuelUsed,
  isGreenFlag: true,
  isValidForCalc: true,
  isOutLap: false,
  timestamp: lapNumber * 1000,
  sessionNum: 0,
  ...extra,
});

const fuelProjection = (
  completedLaps: readonly FuelLapData[]
): FuelProjectionSnapshot => ({
  isReplay: false,
  fuelLevel: 42,
  fuelLevelPct: 0.7,
  currentLap: completedLaps.length + 1,
  lapDistPct: 0.4,
  currentLapUsage: 1.1,
  projectedLapUsage: 2.6,
  lastLapUsage: 2.6,
  sessionLapsRemain: 20,
  sessionTimeRemain: 2700,
  sessionTimeTotal: 3600,
  sessionFlags: 0,
  sessionState: 4,
  sessionNum: 0,
  sessionLaps: 40,
  calculatedTotalRaceLaps: 40,
  estimatedLapsRemaining: 20,
  hasValidRaceEstimate: true,
  isFixedLapRace: true,
  sessionType: 'Race',
  isOnTrack: true,
  fuelTankCapacity: 60,
  completedLaps,
  engine: {
    accumulatedRefuel: 0,
    isLapDistPctReset: false,
    lapCrossingTime: 0,
    lapStartFuel: 42,
    lastLap: completedLaps.length,
    lastLapDistPct: 0.4,
    lastSessionFlags: 0,
    wasOnPitRoad: false,
  },
});

const DRIVE_SPEED_MPS = 62;

const cruiseFrame = (elapsedSec: number): ChannelFrame => ({
  'track-state.snapshot': trackState({
    sessionTime: 100 + elapsedSec,
    speed: DRIVE_SPEED_MPS,
    lapDistPct: ((elapsedSec * DRIVE_SPEED_MPS) / 5800) % 1,
    version: Math.round(elapsedSec * 20),
  }),
});

const gForceFrame = (elapsedSec: number): ChannelFrame => ({
  'car-dynamics.snapshot': carDynamics({
    lateralAccel: Math.sin(elapsedSec * 1.3) * 14,
    longitudinalAccel: Math.cos(elapsedSec * 0.9) * 11,
    version: Math.round(elapsedSec * 20),
  }),
  'track-state.snapshot': trackState(),
});

const steeringFrame = (elapsedSec: number): ChannelFrame => ({
  'driver-controls.snapshot': {
    steeringWheelAngle: Math.sin(elapsedSec * 0.8) * 3.2,
    version: Math.round(elapsedSec * 20),
  },
  'car-condition.snapshot': carCondition({ steeringWheelAngleMax: 7.85 }),
  'track-state.snapshot': trackState(),
});

const meta: Meta = {
  title: 'widgets/DrivingMetrics',
  decorators: [TelemetryDecoratorWithConfig()],
};

export default meta;

type Story = StoryObj;

export const StintHistoryTwoStints: Story = {
  render: () => <StintHistory />,
  decorators: [
    sized(400, 140),
    ChannelSnapshotDecorator({
      'fuel.projection': fuelProjection([
        lap(1, 98.4, 2.7, { isOutLap: true }),
        lap(2, 92.1, 2.6),
        lap(3, 91.8, 2.6),
        lap(4, 92.4, 2.7, { isInLap: true }),
        lap(5, 101.2, 2.4, { isOutLap: true }),
        lap(6, 91.5, 2.6),
        lap(7, 91.9, 2.6),
      ]),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const StintHistoryEmpty: Story = {
  render: () => <StintHistory />,
  decorators: [
    sized(400, 140),
    ChannelSnapshotDecorator({
      'fuel.projection': fuelProjection([]),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const FrictionCircleMoving: Story = {
  render: () => <FrictionCircle />,
  decorators: [sized(180, 210), MovingChannelsDecorator(gForceFrame)],
};

export const BrakePressureUnderBraking: Story = {
  render: () => <BrakePressure />,
  decorators: [
    sized(220, 150),
    ChannelSnapshotDecorator({
      'car-dynamics.snapshot': carDynamics({
        brakeLinePressure: [58.2, 57.9, 41.3, 41.0],
      }),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const BrakePressureLmu: Story = {
  render: () => <BrakePressure />,
  decorators: [
    sized(220, 150),
    LmuDecorator,
    ChannelSnapshotDecorator({
      'car-dynamics.snapshot': carDynamics({
        brakeLinePressure: [0.517, 0.514, 0.372, 0.369],
      }),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const SuspensionPositionCornering: Story = {
  render: () => <SuspensionPosition />,
  decorators: [
    sized(220, 150),
    ChannelSnapshotDecorator({
      'car-dynamics.snapshot': carDynamics({
        suspensionDeflection: [0.042, 0.018, 0.051, 0.024],
      }),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const SuspensionPositionNoData: Story = {
  render: () => <SuspensionPosition />,
  decorators: [
    sized(220, 150),
    ChannelSnapshotDecorator({
      'car-dynamics.snapshot': carDynamics({}),
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const TrackClockAfternoon: Story = {
  render: () => <TrackClock />,
  decorators: [
    sized(220, 80),
    ChannelSnapshotDecorator({
      'session-bar.snapshot': {
        ...sessionBarStorySnapshot,
        sessionTimeOfDay: 15 * 3600 + 42 * 60 + 7,
      },
      'track-state.snapshot': trackState(),
    }),
  ],
};

export const SteeringMeterTurning: Story = {
  render: () => <SteeringMeter />,
  decorators: [sized(300, 100), MovingChannelsDecorator(steeringFrame)],
};

export const CruiseOdometerDriving: Story = {
  render: () => <CruiseOdometer />,
  decorators: [sized(300, 100), MovingChannelsDecorator(cruiseFrame)],
};
