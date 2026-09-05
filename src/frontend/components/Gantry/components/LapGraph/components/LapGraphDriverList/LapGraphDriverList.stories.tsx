import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { LapGraphDriverList } from './LapGraphDriverList';
import type { DriverListEntry } from './LapGraphDriverList';

const SURNAMES = [
  'Verstappen',
  'Hamilton',
  'Leclerc',
  'Norris',
  'Russell',
  'Alonso',
  'Sainz',
  'Piastri',
  'Gasly',
  'Ocon',
  'Hulkenberg',
  'Tsunoda',
];

interface DriverListArgs {
  driverCount: number;
  /** Drivers at the back of the list still on their opening lap. */
  withoutLines: number;
  playerIndex: number;
  /** Numeric class colour, shared by every line in the chart. */
  classColorValue: number;
  isMultiClass: boolean;
  shownCarIdxs: number[];
  focusedCarIdx: number | null;
}

const buildRoster = ({
  driverCount,
  withoutLines,
  playerIndex,
}: DriverListArgs): DriverListEntry[] =>
  Array.from({ length: driverCount }, (_, index) => ({
    carIdx: index,
    carNumber: String(index + 1),
    displayName: SURNAMES[index % SURNAMES.length],
    position: index + 1,
    isPlayer: index === playerIndex,
    hasLine: index < driverCount - withoutLines,
    // Sequential grid slots walk through every identity pattern once the
    // roster passes 10 (dashed), 20 (dotted) and 30 (dash-dot) drivers.
    gridSlot: index + 1,
  }));

interface HarnessProps {
  args: DriverListArgs;
}

/** Toggling and hovering are callbacks, so the story owns that state. */
const Harness = ({ args }: HarnessProps) => {
  const drivers = useMemo(() => buildRoster(args), [args]);
  const [shown, setShown] = useState<readonly number[]>(args.shownCarIdxs);
  const [hovered, setHovered] = useState<number | null>(args.focusedCarIdx);

  return (
    <div className="h-screen flex bg-slate-900 text-xs p-3">
      <div className="flex-1 flex items-center justify-center text-slate-600">
        Chart goes here
      </div>
      <LapGraphDriverList
        drivers={drivers}
        classColorValue={args.classColorValue}
        isMultiClass={args.isMultiClass}
        shownCarIdxs={shown}
        focusedCarIdx={hovered}
        onToggle={(carIdx) =>
          setShown((current) =>
            current.includes(carIdx)
              ? current.filter((idx) => idx !== carIdx)
              : [...current, carIdx]
          )
        }
        onHover={setHovered}
      />
    </div>
  );
};

const meta: Meta = {
  component: LapGraphDriverList,
  title: 'widgets/Gantry/components/LapGraphDriverList',
  parameters: { layout: 'fullscreen' },
  args: {
    driverCount: SURNAMES.length,
    withoutLines: 2,
    playerIndex: 3,
    // 16767577 is iRacing's class-1 (yellow) colour decimal.
    classColorValue: 16767577,
    isMultiClass: false,
    shownCarIdxs: [0, 1],
    focusedCarIdx: null,
  },
  argTypes: {
    classColorValue: {
      control: 'number',
      description:
        'Numeric class colour, shared by every line in the chart. Only visible on the car-number chip when isMultiClass is true.',
      table: { category: 'Props' },
    },
    isMultiClass: {
      control: 'boolean',
      description:
        'Whether the session has more than one car class, which puts the class colour on the car-number chip.',
      table: { category: 'Props' },
    },
    shownCarIdxs: {
      control: 'object',
      description: 'Cars drawn at full strength. Clicking a name toggles one.',
      table: { category: 'Props' },
    },
    focusedCarIdx: {
      control: 'number',
      description: 'The one line drawn brightest. Hovering a row overrides it.',
      table: { category: 'Props' },
    },
    driverCount: {
      control: { type: 'range', min: 0, max: 60, step: 1 },
      description: 'Drivers in the generated roster.',
      table: { category: 'Generated roster' },
    },
    withoutLines: {
      control: { type: 'range', min: 0, max: 12, step: 1 },
      description: 'Drivers at the back still on their opening lap.',
      table: { category: 'Generated roster' },
    },
    playerIndex: {
      control: 'number',
      description: 'Which row is marked as the player.',
      table: { category: 'Generated roster' },
    },
  },
  // Remounted on an arg change so the pin state re-seeds from the control.
  render: (args) => (
    <Harness key={JSON.stringify(args)} args={args as DriverListArgs} />
  ),
};
export default meta;
type Story = StoryObj<DriverListArgs>;

export const Field: Story = {};

export const WaitingForTheGrid: Story = {
  args: { driverCount: 0, shownCarIdxs: [] },
};

export const MultiClass: Story = {
  args: {
    isMultiClass: true,
    // 3395327 is iRacing's class-2 (blue) colour decimal.
    classColorValue: 3395327,
  },
};

export const IdentityPatterns: Story = {
  args: {
    // 34 grid slots shows all four patterns in one roster: solid (1-10),
    // dashed (11-20), dotted (21-30) and into dash-dot (31-34).
    driverCount: 34,
    withoutLines: 0,
    playerIndex: 0,
    shownCarIdxs: Array.from({ length: 34 }, (_, index) => index),
  },
};
