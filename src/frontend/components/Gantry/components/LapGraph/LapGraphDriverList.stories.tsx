import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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

const roster: DriverListEntry[] = SURNAMES.map((displayName, index) => ({
  carIdx: index,
  carNumber: String(index + 1),
  displayName,
  position: index + 1,
  isPlayer: index === 3,
  // The last two are still on their opening lap.
  hasLine: index < SURNAMES.length - 2,
}));

interface HarnessProps {
  drivers: DriverListEntry[];
}
const Harness = ({ drivers }: HarnessProps) => {
  const [shown, setShown] = useState<readonly number[]>([0, 1]);
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="h-screen flex bg-slate-900 text-xs p-3">
      <div className="flex-1 flex items-center justify-center text-slate-600">
        Chart goes here
      </div>
      <LapGraphDriverList
        drivers={drivers}
        classColor="#22c55e"
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

const meta: Meta<typeof LapGraphDriverList> = {
  component: LapGraphDriverList,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof LapGraphDriverList>;

export const Field: Story = {
  render: () => <Harness drivers={roster} />,
};

export const WaitingForTheGrid: Story = {
  render: () => <Harness drivers={[]} />,
};
