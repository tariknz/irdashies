import { describe, expect, it } from 'vitest';
import { CLIO_PIT_PROFILE, type PitStopRecord } from '@irdashies/types';
import {
  buildPitStopRows,
  summarisePitTeams,
  type PitCar,
} from './pitStopView';

const car = (carIdx: number, overrides: Partial<PitCar> = {}): PitCar => ({
  carIdx,
  carNumber: String(carIdx + 10),
  teamName: `Team ${carIdx}`,
  classId: 1,
  className: 'CUP',
  classColor: 0xffffff,
  carPath: 'renaultcliocup',
  lap: 50,
  classPosition: carIdx + 1,
  isPlayer: false,
  ...overrides,
});

const stop = (overrides: Partial<PitStopRecord>): PitStopRecord => ({
  id: 1,
  carIdx: 0,
  kind: 'pit',
  lap: 20,
  entryTime: 1000,
  exitTime: 1080,
  stallTime: 1010,
  stallSeconds: 60,
  stallEnteredAt: null,
  driverIdIn: 1,
  driverNameIn: 'Driver A',
  driverIdOut: 1,
  driverNameOut: 'Driver A',
  classPositionIn: 3,
  classPositionOut: 5,
  compoundIn: 0,
  compoundOut: 0,
  fastRepairs: 0,
  ...overrides,
});

const cars = new Map([
  [0, car(0, { isPlayer: true })],
  [1, car(1)],
]);

describe('buildPitStopRows', () => {
  it('numbers each car’s stops and measures its stints', () => {
    const rows = buildPitStopRows(
      {
        stops: [
          stop({ id: 1, carIdx: 0, lap: 20 }),
          stop({ id: 2, carIdx: 1, lap: 22 }),
          stop({ id: 3, carIdx: 0, lap: 41 }),
        ],
      },
      cars,
      [CLIO_PIT_PROFILE],
      2000
    );
    expect(rows.map((row) => [row.number, row.stintLaps])).toEqual([
      [1, 20],
      [1, 22],
      [2, 21],
    ]);
    expect(rows[0].positionChange).toBe(-2);
    expect(rows[0].pitLaneSeconds).toBe(80);
  });

  it('ages a stop still in progress from the session clock', () => {
    const [row] = buildPitStopRows(
      {
        stops: [
          stop({ exitTime: null, stallSeconds: 0, stallEnteredAt: 1010 }),
        ],
      },
      cars,
      [CLIO_PIT_PROFILE],
      1030
    );
    expect(row.inProgress).toBe(true);
    expect(row.pitLaneSeconds).toBe(30);
    expect(row.stallSeconds).toBe(20);
    expect(row.positionChange).toBeNull();
  });

  it('spots a driver change', () => {
    const [row] = buildPitStopRows(
      { stops: [stop({ driverIdOut: 2, driverNameOut: 'Driver B' })] },
      cars,
      [CLIO_PIT_PROFILE],
      2000
    );
    expect(row.driverChanged).toBe(true);
  });
});

describe('summarisePitTeams', () => {
  it('compares each team with the player', () => {
    const rows = buildPitStopRows(
      {
        stops: [
          stop({ id: 1, carIdx: 0, lap: 20 }),
          stop({ id: 2, carIdx: 1, lap: 18 }),
          stop({
            id: 3,
            carIdx: 1,
            lap: 36,
            entryTime: 3000,
            exitTime: 3100,
            driverIdOut: 2,
            driverNameOut: 'Driver B',
          }),
        ],
      },
      cars,
      [CLIO_PIT_PROFILE],
      4000
    );
    const summaries = summarisePitTeams(rows, cars, 0);
    const rival = summaries.find((summary) => summary.carIdx === 1);
    expect(rival).toMatchObject({
      stops: 2,
      pitLaneSeconds: 180,
      averageStintLaps: 18,
      lastStopLap: 36,
      lapsSinceStop: 14,
      nextStopLap: 54,
      driverChanges: 1,
      drivers: ['Driver A', 'Driver B'],
      stopsDelta: 1,
      pitLaneDelta: 100,
    });
    expect(summaries.find((summary) => summary.carIdx === 0)?.stopsDelta).toBe(
      null
    );
  });

  it('includes the player before their first stop', () => {
    const rows = buildPitStopRows(
      { stops: [stop({ carIdx: 1 })] },
      cars,
      [CLIO_PIT_PROFILE],
      2000
    );
    const summaries = summarisePitTeams(rows, cars, 0);
    expect(summaries.find((summary) => summary.carIdx === 1)?.stopsDelta).toBe(
      1
    );
  });
});
