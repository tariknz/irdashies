import { Meta, StoryObj } from '@storybook/react-vite';
import type { Standings } from '@irdashies/domain';
import { PodiumCard } from './PodiumCard';

export default {
  title: 'widgets/BroadcastPodium',
} as Meta;

type Story = StoryObj;

const car = (
  carIdx: number,
  classPosition: number,
  name: string,
  carClass: Standings['carClass'],
  gap?: number
) =>
  ({
    carIdx,
    classPosition,
    carId: 0,
    driver: { name, carNum: String(10 + carIdx) },
    carClass,
    gap: gap === undefined ? undefined : { value: gap, laps: 0 },
  }) as Standings;

const GTP = { id: 1, color: 0xffda59, name: 'GTP' } as Standings['carClass'];
const GTD = { id: 2, color: 0x33ceff, name: 'GTD' } as Standings['carClass'];

const groups: [string, Standings[]][] = [
  [
    '1',
    [
      car(1, 1, 'Sebastien Bourdais', GTP),
      car(2, 2, 'Felipe Nasr', GTP, 1.537),
      car(3, 3, 'Nick Tandy', GTP, 4.211),
      car(4, 4, 'Earl Bamber', GTP, 7.9),
    ],
  ],
  [
    '2',
    [
      car(5, 1, 'Jack Hawksworth', GTD),
      car(6, 2, 'Russell Ward', GTD, 0.842),
      car(7, 3, 'Frankie Montecalvo', GTD, 3.05),
    ],
  ],
];

const frame = (children: React.ReactNode) => (
  <div
    className="w-[300px] text-sm"
    style={{ ['--bg-opacity' as string]: '90%' }}
  >
    {children}
  </div>
);

export const Podium: Story = {
  render: () => frame(<PodiumCard groups={groups} />),
};
