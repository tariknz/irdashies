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
  carClass: Standings['carClass']
) =>
  ({
    carIdx,
    classPosition,
    carId: 0,
    driver: { name, carNum: String(10 + carIdx) },
    carClass,
  }) as Standings;

const GTP = { id: 1, color: 0xffda59, name: 'GTP' } as Standings['carClass'];
const GTD = { id: 2, color: 0x33ceff, name: 'GTD' } as Standings['carClass'];

const groups: [string, Standings[]][] = [
  [
    '1',
    [
      car(1, 1, 'Sebastien Bourdais', GTP),
      car(2, 2, 'Felipe Nasr', GTP),
      car(3, 3, 'Nick Tandy', GTP),
      car(4, 4, 'Earl Bamber', GTP),
    ],
  ],
  [
    '2',
    [
      car(5, 1, 'Jack Hawksworth', GTD),
      car(6, 2, 'Russell Ward', GTD),
      car(7, 3, 'Frankie Montecalvo', GTD),
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

export const Steps: Story = {
  render: () => frame(<PodiumCard groups={groups} look="steps" />),
};

export const Trophies: Story = {
  render: () => frame(<PodiumCard groups={groups} look="trophy" />),
};
