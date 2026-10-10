import type { Standings } from '@irdashies/domain';

// A made-up field, so previews and stories work with no sim running.

const GTP = { id: 1, color: 0xffda59, name: 'GTP' };
const GTD = { id: 2, color: 0x33ceff, name: 'GTD' };

const car = (
  carIdx: number,
  classPosition: number,
  name: string,
  carId: number,
  carClass: typeof GTP,
  extra: Partial<Standings> = {}
) =>
  ({
    carIdx,
    position: carIdx + 1,
    classPosition,
    carId,
    driver: { name, carNum: String(10 + carIdx), teamName: '' },
    carClass,
    gap:
      classPosition === 1
        ? { value: undefined, laps: 0 }
        : { value: (classPosition - 1) * 1.8, laps: 0 },
    interval: classPosition === 1 ? undefined : 0.6 + classPosition * 0.3,
    fastestTime: 95 + carIdx * 0.37,
    lap: 24,
    positionChange: (carIdx % 3) - 1,
    lastPitLap: 18 + (carIdx % 3),
    tireCompound: carIdx % 2,
    onPitRoad: false,
    repair: false,
    penalty: false,
    slowdown: false,
    dnf: false,
    radioActive: false,
    ...extra,
  }) as unknown as Standings;

/** Two classes of four, for the settings preview and stories. */
export const DEMO_GROUPS: [string, Standings[]][] = [
  [
    '1',
    [
      car(0, 1, 'Sebastien Bourdais', 168, GTP),
      car(1, 2, 'Felipe Nasr', 174, GTP, { radioActive: true }),
      car(2, 3, 'Nick Tandy', 174, GTP),
      car(3, 4, 'Ricky Taylor', 170, GTP, { onPitRoad: true }),
    ],
  ],
  [
    '2',
    [
      car(4, 1, 'Jack Hawksworth', 133, GTD),
      car(5, 2, 'Russell Ward', 156, GTD),
      car(6, 3, 'Frankie Montecalvo', 169, GTD),
      car(7, 4, 'Robby Foley', 132, GTD),
    ],
  ],
];
