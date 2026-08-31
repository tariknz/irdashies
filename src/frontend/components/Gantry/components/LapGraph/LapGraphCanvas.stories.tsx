import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
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

interface CanvasArgs {
  cars: number;
  laps: number;
  withRepair: boolean;
  mode: LapGraphMode;
  focusedCarIdx: number | null;
  pinnedCarIdxs: number[];
  defaultLapWindow?: number;
  axisCaption?: string;
}

/** Pinning is a callback on the real component, so the story holds the state. */
const Harness = ({
  cars,
  laps,
  withRepair,
  mode,
  focusedCarIdx,
  pinnedCarIdxs,
  defaultLapWindow,
  axisCaption,
}: CanvasArgs) => {
  const series = useMemo(
    () => buildField({ cars, laps, mode, withRepair }),
    [cars, laps, mode, withRepair]
  );
  const [pinned, setPinned] = useState<readonly number[]>(pinnedCarIdxs);

  return (
    <div className="w-full h-screen bg-slate-900 p-3">
      <LapGraphCanvas
        series={series}
        mode={mode}
        axisCaption={axisCaption ?? CAPTIONS[mode]}
        pinnedCarIdxs={pinned}
        focusedCarIdx={focusedCarIdx}
        defaultLapWindow={defaultLapWindow}
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

const meta: Meta = {
  component: LapGraphCanvas,
  title: 'widgets/Gantry/components/LapGraphCanvas',
  parameters: { layout: 'fullscreen' },
  args: {
    cars: 60,
    laps: 500,
    withRepair: true,
    mode: 'trace',
    focusedCarIdx: null,
    pinnedCarIdxs: [0, 1, 17],
    defaultLapWindow: undefined,
    axisCaption: undefined,
  },
  argTypes: {
    mode: {
      control: 'inline-radio',
      options: ['trace', 'position', 'gap'],
      description: 'Which quantity the y axis measures.',
      table: { category: 'Props' },
    },
    focusedCarIdx: {
      control: 'number',
      description: 'The one line drawn brightest, on top of the field.',
      table: { category: 'Props' },
    },
    pinnedCarIdxs: {
      control: 'object',
      description: 'Cars drawn at full strength. Clicking a line toggles one.',
      table: { category: 'Props' },
    },
    defaultLapWindow: {
      control: { type: 'range', min: 5, max: 500, step: 5 },
      description: 'Laps visible before the user zooms.',
      table: { category: 'Props' },
    },
    axisCaption: {
      control: 'text',
      description: 'Caption under the y axis. Defaults to one per mode.',
      table: { category: 'Props' },
    },
    cars: {
      control: { type: 'range', min: 0, max: 60, step: 1 },
      description: 'Cars in the generated field.',
      table: { category: 'Generated field' },
    },
    laps: {
      control: { type: 'range', min: 1, max: 500, step: 1 },
      description: 'Laps each car completes.',
      table: { category: 'Generated field' },
    },
    withRepair: {
      control: 'boolean',
      description: 'Give one car a ten-minute repair at half distance.',
      table: { category: 'Generated field' },
    },
  },
  // Remounted on an arg change so the pin state re-seeds from the control.
  render: (args) => (
    <Harness key={JSON.stringify(args)} {...(args as CanvasArgs)} />
  ),
};
export default meta;
type Story = StoryObj<CanvasArgs>;

/** The scale case: 60 cars, 500 laps, one ten-minute repair at half distance. */
export const Trace: Story = {};

export const Position: Story = {
  args: { mode: 'position' },
};

export const Gap: Story = {
  args: { mode: 'gap' },
};

export const Sprint: Story = {
  args: { cars: 12, laps: 24, withRepair: false, pinnedCarIdxs: [0] },
};

export const FollowedDriver: Story = {
  args: { focusedCarIdx: 42, pinnedCarIdxs: [] },
};

export const Empty: Story = {
  args: { cars: 0, pinnedCarIdxs: [] },
};
