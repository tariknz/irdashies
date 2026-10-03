import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';
import { buildTrackGeometry, getTrackPathData } from '@irdashies/domain/track';
import {
  RadarDisplay,
  type RadarCarAppearance,
  type RadarFrame,
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
  style,
}: StoryProps) => {
  const seconds = useTicker();
  const geometry = useMemo(() => {
    const path = getTrackPathData(trackId);
    return path ? buildTrackGeometry(path, trackLength) : null;
  }, [trackId, trackLength]);

  const demo = demoRadarFrame(seconds);
  const frame: RadarFrame = {
    playerPct: (startPct + (seconds * speed) / trackLength) % 1,
    playerSpeed: speed,
    trackLength,
    cars: demo.cars,
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
