import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LapGraphCanvas } from './LapGraphCanvas';
import type { LapGraphMode, LapGraphSeries, LapPoint } from './LapGraphCanvas';

const CLASS_COLORS = ['#22c55e', '#38bdf8', '#f472b6', '#fbbf24'];

/** Deterministic noise, so a story looks the same on every reload. */
const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const REPAIR_CAR_IDX = 17;
const REPAIR_SECONDS = 600;

interface FieldOptions {
  cars: number;
  laps: number;
  mode: LapGraphMode;
  /** Adds a ten-minute pit and repair to one car at half distance. */
  withRepair?: boolean;
}

const buildPoints = (
  carIdx: number,
  { laps, mode, withRepair }: FieldOptions
): LapPoint[] => {
  const random = seededRandom(carIdx * 7919 + 13);
  const pace = -0.35 + (carIdx % 12) * 0.06;
  const points: LapPoint[] = [];
  let trace = 0;
  let gap = carIdx * 0.9;

  for (let lap = 1; lap <= laps; lap++) {
    const jitter = (random() - 0.5) * 0.6;
    trace += pace + jitter;
    gap += Math.max(0, pace * -0.4 + jitter * 0.3);

    const repair =
      withRepair && carIdx === REPAIR_CAR_IDX && lap > laps / 2
        ? REPAIR_SECONDS
        : 0;

    if (mode === 'position') {
      const drift = Math.round(Math.sin(lap / 30 + carIdx) * 3);
      const penalty = repair ? 20 : 0;
      points.push({
        lap,
        value: Math.min(60, Math.max(1, carIdx + 1 + drift + penalty)),
      });
      continue;
    }

    if (mode === 'gap') {
      points.push({ lap, value: Math.max(0, gap + repair) });
      continue;
    }

    points.push({ lap, value: trace - repair });
  }

  return points;
};

const buildField = (options: FieldOptions): LapGraphSeries[] =>
  Array.from({ length: options.cars }, (_, carIdx) => ({
    carIdx,
    carNumber: String(carIdx + 1),
    displayName: `Driver ${String(carIdx + 1).padStart(2, '0')}`,
    isPlayer: carIdx === 3,
    color: CLASS_COLORS[carIdx % CLASS_COLORS.length],
    points: buildPoints(carIdx, options),
  }));

const CAPTIONS: Record<LapGraphMode, string> = {
  trace: 'seconds vs reference pace, higher is better',
  position: 'class position, 1 at the top',
  gap: 'seconds behind the class leader',
};

interface HarnessProps {
  series: readonly LapGraphSeries[];
  mode: LapGraphMode;
  focusedCarIdx?: number | null;
  initialPins?: readonly number[];
}

const Harness = ({
  series,
  mode,
  focusedCarIdx = null,
  initialPins = [],
}: HarnessProps) => {
  const [pinned, setPinned] = useState<readonly number[]>(initialPins);
  return (
    <div className="w-full h-screen bg-slate-900 p-3">
      <LapGraphCanvas
        series={series}
        mode={mode}
        axisCaption={CAPTIONS[mode]}
        pinnedCarIdxs={pinned}
        focusedCarIdx={focusedCarIdx}
        onTogglePin={(carIdx) =>
          setPinned((current) =>
            current.includes(carIdx)
              ? current.filter((idx) => idx !== carIdx)
              : [...current, carIdx]
          )
        }
      />
    </div>
  );
};

const meta: Meta<typeof LapGraphCanvas> = {
  component: LapGraphCanvas,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof LapGraphCanvas>;

const enduranceTrace = buildField({
  cars: 60,
  laps: 500,
  mode: 'trace',
  withRepair: true,
});

/** The scale case: 60 cars, 500 laps, one ten-minute repair at half distance. */
export const Trace: Story = {
  render: () => (
    <Harness series={enduranceTrace} mode="trace" initialPins={[0, 1, 17]} />
  ),
};

export const Position: Story = {
  render: () => (
    <Harness
      series={buildField({
        cars: 60,
        laps: 500,
        mode: 'position',
        withRepair: true,
      })}
      mode="position"
      initialPins={[0, 1, 17]}
    />
  ),
};

export const Gap: Story = {
  render: () => (
    <Harness
      series={buildField({
        cars: 60,
        laps: 500,
        mode: 'gap',
        withRepair: true,
      })}
      mode="gap"
      initialPins={[0, 1, 17]}
    />
  ),
};

export const Sprint: Story = {
  render: () => (
    <Harness
      series={buildField({ cars: 12, laps: 24, mode: 'trace' })}
      mode="trace"
      initialPins={[0]}
    />
  ),
};

export const FollowedDriver: Story = {
  render: () => (
    <Harness series={enduranceTrace} mode="trace" focusedCarIdx={42} />
  ),
};

export const Empty: Story = {
  render: () => <Harness series={[]} mode="trace" />,
};
