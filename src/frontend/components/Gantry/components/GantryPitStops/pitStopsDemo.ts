import {
  buildPitStopRows,
  summarisePitTeams,
  type PitCar,
} from '@irdashies/domain';
import { CLIO_PIT_PROFILE, type PitStopRecord } from '@irdashies/types';
import type { PitStopData } from './usePitStopData';

// A made-up two-class field for stories: twelve Clios and four GT4s.

const CUP = { id: 1, name: 'CUP', color: 0xffda59 };
const GT4 = { id: 2, name: 'GT4', color: 0x33ceff };

const cars: PitCar[] = Array.from({ length: 16 }, (_, carIdx) => {
  const carClass = carIdx < 12 ? CUP : GT4;
  return {
    carIdx,
    carNumber: String(carIdx + 10),
    teamName: `Team ${String.fromCharCode(65 + carIdx)}`,
    classId: carClass.id,
    className: carClass.name,
    classColor: carClass.color,
    carPath: carClass === CUP ? 'renaultcliocup' : 'gt4car',
    lap: 61 - (carIdx % 3),
    classPosition: carClass === CUP ? carIdx + 1 : carIdx - 11,
    isPlayer: carIdx === 2,
  };
});

/** Stops every ~18 laps, varied service, a swap every other stop. */
const buildStops = (inProgress: boolean): PitStopRecord[] => {
  const stops: PitStopRecord[] = [];
  let id = 1;
  for (let stint = 1; stint <= 3; stint += 1) {
    for (const car of cars) {
      const lap = stint * 18 + (car.carIdx % 4);
      const entryTime = lap * 136 + car.carIdx * 3;
      const stall = [78, 60, 40, 38.5][(car.carIdx + stint) % 4];
      const swap = (car.carIdx + stint) % 2 === 0;
      stops.push({
        id: id++,
        carIdx: car.carIdx,
        kind: 'pit',
        lap,
        entryTime,
        exitTime: entryTime + stall + 24,
        stallTime: entryTime + 11,
        stallSeconds: stall,
        stallEnteredAt: null,
        driverIdIn: car.carIdx * 10 + stint,
        driverNameIn: `Driver ${car.carIdx}-${stint}`,
        driverIdOut: swap
          ? car.carIdx * 10 + stint + 1
          : car.carIdx * 10 + stint,
        driverNameOut: swap
          ? `Driver ${car.carIdx}-${stint + 1}`
          : `Driver ${car.carIdx}-${stint}`,
        classPositionIn: car.classPosition,
        classPositionOut: car.classPosition + ((car.carIdx + stint) % 3),
        compoundIn: 0,
        compoundOut: 0,
        fastRepairs: car.carIdx === 7 && stint === 2 ? 1 : 0,
      });
    }
  }
  stops.push({
    id: id++,
    carIdx: 15,
    kind: 'pit',
    lap: 60,
    entryTime: 60 * 136,
    exitTime: 60 * 136 + 25,
    stallTime: null,
    stallSeconds: 0,
    stallEnteredAt: null,
    driverIdIn: 151,
    driverNameIn: 'Driver 15-3',
    driverIdOut: 151,
    driverNameOut: 'Driver 15-3',
    classPositionIn: 4,
    classPositionOut: 4,
    compoundIn: 0,
    compoundOut: 0,
    fastRepairs: 0,
  });
  if (inProgress) {
    const entryTime = 61 * 136;
    stops.push({
      ...stops[0],
      id,
      carIdx: 4,
      lap: 61,
      entryTime,
      exitTime: null,
      stallTime: entryTime + 11,
      stallSeconds: 0,
      stallEnteredAt: entryTime + 11,
      driverIdIn: 44,
      driverNameIn: 'Driver 4-4',
      driverIdOut: 44,
      driverNameOut: 'Driver 4-4',
      classPositionOut: 0,
    });
  }
  return stops;
};

export const demoPitStopData = ({
  inProgress = true,
  empty = false,
} = {}): PitStopData => {
  const carMap = new Map(cars.map((car) => [car.carIdx, car]));
  const stops = empty ? [] : buildStops(inProgress);
  const sessionTime = 61 * 136 + 30;
  const profile = { ...CLIO_PIT_PROFILE, fuelPerLap: 2 };
  const rows = buildPitStopRows({ stops }, carMap, [profile], sessionTime);
  return {
    rows,
    summaries: summarisePitTeams(rows, carMap, 2),
    classes: [
      { id: '1', name: CUP.name, color: CUP.color },
      { id: '2', name: GT4.name, color: GT4.color },
    ],
    playerCarIdx: 2,
    defaultClassId: '1',
    receivedAt: performance.now(),
    sessionNum: 2,
  };
};
