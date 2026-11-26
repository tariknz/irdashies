import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';
import {
  buildTrackGeometry,
  getTrackPathData,
  pointAtProgress,
  tangentAtProgress,
  useTrackDrawing,
  type TrackGeometry,
} from '@irdashies/domain/track';
import lmuTrackMapStoryData from '../TrackMap/lmuTrackMapStoryData.json';
import {
  RadarDisplay,
  type RadarCarAppearance,
  type RadarFrame,
  type RadarFrameCar,
} from './components/RadarDisplay';
import { DEMO_LABELS, demoRadarFrame } from './radarDemo';
import type { RadarStyle } from './radarDraw';
import { radarStyleFrom } from './radarStyle';
import { getWidgetDefaultConfig } from '@irdashies/types';

const STYLE: RadarStyle = radarStyleFrom(getWidgetDefaultConfig('radar'), {
  length: 4.5,
  width: 1.9,
});

const CLASS_COLORS = ['#f59e0b', '#3b82f6', '#ec4899', '#22c55e'];

const appearanceFor = (fill: string, label: string): RadarCarAppearance => ({
  fill,
  textColor: '#0f172a',
  label,
  length: 4.6,
  width: 2.0,
});

const MEASURED_LANE_M = 2.6;

const measuredCar = (
  carIdx: number,
  dist: number,
  lateralM: number,
  relativeSpeed: number,
  headingRad = 0
): RadarFrameCar => ({
  carIdx,
  dist,
  relativeSpeed,
  lane: lateralM / MEASURED_LANE_M,
  lateralM,
  headingRad,
  offTrack: false,
});

const measuredCars = (seconds: number): RadarFrameCar[] => [
  measuredCar(1, -14 + 7 * (seconds % 4), 3.1, 7),
  measuredCar(2, 1.2 + Math.sin(seconds), -3, 0, 0.12),
  measuredCar(3, 18, 0.4, 0),
  measuredCar(4, -6, -5.8, 0),
];

const useTicker = (intervalMs = 40) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(
      () => setSeconds((performance.now() - started) / 1000),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [intervalMs]);
  return seconds;
};

interface StoryProps {
  trackId: number;
  trackLength: number;
  /** Lap progress the focus car starts from. */
  startPct: number;
  speed: number;
  multiclass: boolean;
  /** Metres to the car to line up behind; unset when not pacing. */
  followDist?: number;
  followCarIdx?: number;
  followPaceCar?: boolean;
  measured?: boolean;
  style: RadarStyle;
}

/** Drives a small pack around a real track drawing at a steady speed. */
const OnTrack = ({
  trackId,
  trackLength,
  startPct,
  speed,
  multiclass,
  followDist,
  followCarIdx = 3,
  followPaceCar = false,
  measured = false,
  style,
}: StoryProps) => {
  const seconds = useTicker();
  const trackDrawing = useTrackDrawing(trackId);
  const geometry = useMemo(() => {
    const path = getTrackPathData(trackId, trackDrawing);
    return path ? buildTrackGeometry(path, trackLength) : null;
  }, [trackId, trackLength, trackDrawing]);

  const demo = demoRadarFrame(seconds);
  const frame: RadarFrame = {
    playerPct: (startPct + (seconds * speed) / trackLength) % 1,
    playerSpeed: speed,
    trackLength,
    cars: measured ? measuredCars(seconds) : demo.cars,
    focusBrake: demo.focusBrake,
    follow:
      followDist === undefined
        ? null
        : { carIdx: followCarIdx, dist: followDist, isPaceCar: followPaceCar },
  };
  const appearance = useMemo(
    () =>
      new Map(
        Object.entries(DEMO_LABELS).map(([carIdx, label], index) => [
          Number(carIdx),
          appearanceFor(
            multiclass ? CLASS_COLORS[index % CLASS_COLORS.length] : '#f59e0b',
            label
          ),
        ])
      ),
    [multiclass]
  );

  return (
    <RadarDisplay
      frame={frame}
      appearance={appearance}
      geometry={geometry}
      style={style}
      dive={DIVE}
    />
  );
};

const DIVE = {
  enabled: true,
  minClosingKmh: 15,
  warnSeconds: 1.2,
  cornerSide: true,
};

const meta: Meta<typeof OnTrack> = {
  component: OnTrack,
  title: 'widgets/Radar',
  decorators: [
    (Story) => (
      <div className="w-[320px] h-[320px] m-5">
        <Story />
      </div>
    ),
  ],
  args: {
    trackId: 1,
    trackLength: 4000,
    startPct: 0.3,
    speed: 45,
    multiclass: false,
    style: STYLE,
  },
  argTypes: {
    trackId: { control: { type: 'number' } },
    trackLength: { control: { type: 'number' } },
    startPct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    speed: { control: { type: 'range', min: 0, max: 90, step: 5 } },
  },
};
export default meta;

type Story = StoryObj<typeof OnTrack>;

export const FollowingTheTrack: Story = {};

export const Multiclass: Story = {
  args: { multiclass: true },
};

export const StraightRoadWithoutDrawing: Story = {
  args: { trackId: -1 },
};

export const WideRange: Story = {
  args: { style: { ...STYLE, range: 60, ringSpacing: 20 } },
};

export const NoRoadNoRings: Story = {
  args: { style: { ...STYLE, showTrackMap: false, showRings: false } },
};

export const PacingFollowCarAhead: Story = {
  args: { followDist: 16 },
};

export const PacingFollowBeyondRange: Story = {
  args: { followDist: 85, followCarIdx: 9 },
};

export const PacingFollowPaceCar: Story = {
  args: { followDist: 25, followPaceCar: true },
};

export const MeasuredWorldPositions: Story = {
  args: { measured: true },
};

const BARCELONA_LAP_M = 4655;

const barcelonaGeometry = (() => {
  const values = lmuTrackMapStoryData['Circuit de Barcelona'];
  const points = Array.from({ length: values.length / 2 }, (_, index) => ({
    x: values[index * 2],
    y: values[index * 2 + 1],
  }));
  return buildTrackGeometry(
    {
      trackPathPoints: [...points, points[0]],
      totalLength: points.length,
      startFinishLength: 0,
      direction: 'anticlockwise',
    },
    BARCELONA_LAP_M
  );
})();

const lmuMapFrame = (
  geometry: TrackGeometry,
  pct: number,
  leftM: number,
  yawOffsetRad: number
): number[] => {
  const point = pointAtProgress(geometry, pct, { x: 0, y: 0 });
  const tangent = tangentAtProgress(geometry, pct, { x: 0, y: 0 });
  const units = geometry.unitsPerMeter;
  const metresPerUnit = 1 / units;
  const x = point.x + tangent.y * leftM * units;
  const y = point.y - tangent.x * leftM * units;
  const angle = Math.atan2(tangent.x, tangent.y) + yawOffsetRad - Math.PI;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    x,
    y,
    c * metresPerUnit,
    -s * metresPerUnit,
    -s * metresPerUnit,
    -c * metresPerUnit,
  ];
};

/** An LMU car through Barcelona's T1-T3, a little off the line and angled. */
const LmuWorldTrack = ({ style }: Pick<StoryProps, 'style'>) => {
  const seconds = useTicker();
  const playerPct = (0.17 + (seconds * 30) / BARCELONA_LAP_M) % 1;
  const appearance = useMemo(
    () =>
      new Map(
        Object.entries(DEMO_LABELS).map(([carIdx, label]) => [
          Number(carIdx),
          appearanceFor('#f59e0b', label),
        ])
      ),
    []
  );
  const frame: RadarFrame = {
    playerPct,
    playerSpeed: 30,
    trackLength: BARCELONA_LAP_M,
    cars: measuredCars(seconds),
    mapFrame: barcelonaGeometry
      ? lmuMapFrame(
          barcelonaGeometry,
          playerPct,
          2.5 * Math.sin(seconds * 0.6),
          0.12 * Math.sin(seconds * 0.8)
        )
      : null,
  };
  return (
    <RadarDisplay
      frame={frame}
      appearance={appearance}
      geometry={barcelonaGeometry}
      style={style}
      dive={DIVE}
    />
  );
};

export const LmuWorldTrackRoad: Story = {
  render: ({ style }) => <LmuWorldTrack style={style} />,
};
