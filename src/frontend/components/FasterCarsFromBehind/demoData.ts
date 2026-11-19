// Demo data for Faster Cars From Behind component
export interface DemoDriver {
  carIdx: number;
  name: string;
  license: string;
  rating: number;
  distance: number;
  percent: number;
  classColor: number;
  className: string;
  classPosition: number;
}

const DEMO_DRIVERS_BASE: Omit<DemoDriver, 'distance' | 'percent'>[] = [
  {
    carIdx: 1001,
    name: 'Tarik Alani',
    license: 'A 2.49',
    rating: 1281,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 3,
  },
  {
    carIdx: 1002,
    name: 'Bjørn Andersen',
    license: 'B 2.70',
    rating: 1256,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 5,
  },
  {
    carIdx: 1003,
    name: 'Ethan D Wilson',
    license: 'C 3.37',
    rating: 1300,
    classColor: 0x33ceff,
    className: 'LMP2',
    classPosition: 2,
  },
  {
    carIdx: 1004,
    name: 'Ben Schmid',
    license: 'D 3.39',
    rating: 1510,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 7,
  },
  {
    carIdx: 1005,
    name: 'Zoltán Szakács',
    license: 'C 3.71',
    rating: 1490,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 9,
  },
  {
    carIdx: 1006,
    name: 'Jack Tomlinson2',
    license: 'D 3.59',
    rating: 1271,
    classColor: 0xffda59,
    className: 'GTP',
    classPosition: 11,
  },
  {
    carIdx: 1007,
    name: 'Romain Vergeon',
    license: 'D 2.95',
    rating: 1512,
    classColor: 0x33ceff,
    className: 'LMP2',
    classPosition: 4,
  },
  {
    carIdx: 1008,
    name: 'Anguiano Perez',
    license: 'B 2.37',
    rating: 1505,
    classColor: 0x33ceff,
    className: 'LMP2',
    classPosition: 6,
  },
  {
    carIdx: 1009,
    name: 'Liu Hang3',
    license: 'D 3.92',
    rating: 1444,
    classColor: 0x33ceff,
    className: 'LMP2',
    classPosition: 8,
  },
  {
    carIdx: 1010,
    name: 'Thomas Searle',
    license: 'A 2.18',
    rating: 2401,
    classColor: 0x33ceff,
    className: 'LMP2',
    classPosition: 10,
  },
];

/** Cars close in then fade back over ~10s. */
export const getDemoCarsBehind = (
  numberDriversBehind: number,
  elapsedSec = 0
): DemoDriver[] => {
  const phase = (elapsedSec % 10) / 10;
  const closeFactor = Math.abs(1 - 2 * phase);

  return DEMO_DRIVERS_BASE.slice(0, numberDriversBehind).map(
    (driver, index) => {
      const baseDistance = -(1.2 + index * 0.7);
      const distance = baseDistance * (0.35 + 0.65 * closeFactor);
      const percent = Math.max(
        5,
        Math.min(95, 90 - index * 8 - closeFactor * 25)
      );
      return { ...driver, distance, percent };
    }
  );
};
