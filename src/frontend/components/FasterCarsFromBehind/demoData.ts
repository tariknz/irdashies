// Demo data for Faster Cars From Behind component
export interface DemoDriver {
  carIdx: number;
  name: string;
  license: string;
  rating: number;
  distance: number;
  percent: number;
  classColor: number;
}

const DEMO_DRIVERS: Omit<DemoDriver, 'distance' | 'percent'>[] = [
  {
    carIdx: 1001,
    name: 'Tarik Alani',
    license: 'A 2.49',
    rating: 1281,
    classColor: 16767577,
  },
  {
    carIdx: 1002,
    name: 'Bjørn Andersen',
    license: 'B 2.70',
    rating: 1256,
    classColor: 16734344,
  },
  {
    carIdx: 1003,
    name: 'Ethan D Wilson',
    license: 'C 3.37',
    rating: 1300,
    classColor: 11430911,
  },
  {
    carIdx: 1004,
    name: 'Ben Schmid',
    license: 'D 3.39',
    rating: 1510,
    classColor: 16767577,
  },
  {
    carIdx: 1005,
    name: 'Zoltán Szakács',
    license: 'C 3.71',
    rating: 1490,
    classColor: 16767577,
  },
  {
    carIdx: 1006,
    name: 'Jack Tomlinson2',
    license: 'D 3.59',
    rating: 1271,
    classColor: 16767577,
  },
  {
    carIdx: 1007,
    name: 'Romain Vergeon',
    license: 'D 2.95',
    rating: 1512,
    classColor: 16734344,
  },
  {
    carIdx: 1008,
    name: 'Anguiano Perez',
    license: 'B 2.37',
    rating: 1505,
    classColor: 16734344,
  },
  {
    carIdx: 1009,
    name: 'Liu Hang3',
    license: 'D 3.92',
    rating: 1444,
    classColor: 16734344,
  },
  {
    carIdx: 1010,
    name: 'Thomas Searle',
    license: 'A 2.18',
    rating: 2401,
    classColor: 11430911,
  },
];

const BASE_DISTANCE = [-1.2, -2.5, -3.8, -4.1, -4.8, -5.2, -5.9, -6.5, -7.1, -7.8];

/**
 * Demo pack at `elapsedSec`. Gaps close and open so threat % bars move and
 * the nearest car crosses into the pulse threshold.
 */
export const getDemoCarsBehind = (
  numberDriversBehind: number,
  elapsedSec = 0
): DemoDriver[] =>
  DEMO_DRIVERS.slice(0, numberDriversBehind).map((driver, i) => {
    const base = BASE_DISTANCE[i] ?? -8;
    // 0→1→0 over ~8s, phase-shifted per car.
    const wave = (Math.sin(elapsedSec * 0.7 + i * 0.9) + 1) / 2;
    // wave 0 = parked at base gap; wave 1 = almost on the bumper.
    const distance = base * (1 - wave * 0.9);
    const percent = Math.round(8 + wave * 90);
    return { ...driver, distance, percent };
  });
