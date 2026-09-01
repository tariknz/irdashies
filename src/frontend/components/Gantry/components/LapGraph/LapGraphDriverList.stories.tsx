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
  classColor: string;
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
  }));

/** Toggling and hovering are callbacks, so the story owns that state. */
const Harness = (args: DriverListArgs) => {
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
        classColor={args.classColor}
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
    classColor: '#22c55e',
    shownCarIdxs: [0, 1],
    focusedCarIdx: null,
  },
  argTypes: {
    classColor: {
      control: 'color',
      description: 'Class colour, shared by every line in the chart.',
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
    <Harness key={JSON.stringify(args)} {...(args as DriverListArgs)} />
  ),
};
export default meta;
type Story = StoryObj<DriverListArgs>;

export const Field: Story = {};

export const WaitingForTheGrid: Story = {
  args: { driverCount: 0, shownCarIdxs: [] },
};
