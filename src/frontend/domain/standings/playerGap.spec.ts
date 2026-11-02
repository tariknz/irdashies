import { beforeEach, describe, expect, it } from 'vitest';
import {
  augmentStandingsWithPlayerGap,
  type Standings,
} from './createStandings';
import type { ReferenceLap } from '@irdashies/types';
import { useReferenceLapStore } from '@irdashies/context';

const driver = (
  carIdx: number,
  overrides: Partial<Standings> = {}
): Standings =>
  ({
    carIdx,
    isPlayer: carIdx === 1,
    onTrack: true,
    delta: carIdx * 10,
    fastestTime: 90 + carIdx,
    carClass: { id: 1, estLapTime: 100 },
    ...overrides,
  }) as Standings;

const gaps = (
  drivers: Standings[],
  options: {
    laps?: number[];
    pct?: number[];
    est?: number[];
    pits?: boolean[];
    session?: string;
  } = {}
) =>
  augmentStandingsWithPlayerGap(
    [
      ['1', drivers.filter((d) => d.carClass.id === 1)],
      ['2', drivers.filter((d) => d.carClass.id === 2)],
    ],
    options.laps ?? [5, 5, 5],
    options.pct ?? [0.9, 0.5, 0.1],
    options.pits ?? [false, false, false],
    options.est ?? [90, 50, 10],
    options.session ?? 'Race'
  ).flatMap(([, drivers]) => drivers);

beforeEach(() => useReferenceLapStore.getState().completeSession());

describe('player-relative standings gaps', () => {
  it('calculates positional gaps across classes and preserves interval and order', () => {
    const result = gaps([
      driver(0),
      driver(1),
      driver(2, {
        carClass: { id: 2, estLapTime: 80 } as Standings['carClass'],
        interval: 4,
      }),
    ]);
    expect(result.map((d) => d.gap)).toEqual([
      { value: -40, laps: 0 },
      { value: 0, laps: 0 },
      { value: 30, laps: 0 },
    ]);
    expect(result[2].interval).toBe(4);
  });

  it('uses recorded pit-approach positions when SDK timing has the wrong sign', () => {
    // fuel-test.irdt, frame 137145, Race SessionTime 1740.0s. Car 13
    // is physically behind player 21 despite its smaller F2 delta.
    const player = driver(21, {
      isPlayer: true,
      delta: 142.9342041015625,
      carClass: { id: 4011, estLapTime: 76.6454 } as Standings['carClass'],
    });
    const opponent = driver(13, {
      isPlayer: false,
      delta: 141.90870666503906,
      carClass: { id: 4011, estLapTime: 76.6454 } as Standings['carClass'],
    });
    const laps: number[] = [],
      pct: number[] = [],
      est: number[] = [];
    laps[21] = laps[13] = 18;
    pct[21] = 0.8667304515838623;
    pct[13] = 0.5567529797554016;
    est[21] = 65.78131866455078;
    est[13] = 43.93949890136719;
    const result = augmentStandingsWithPlayerGap(
      [['4011', [opponent, player]]],
      laps,
      pct,
      [],
      est,
      'Race'
    );
    expect(result[0][1][0].gap).toEqual({ value: 21.841819763183594, laps: 0 });
  });

  it('keeps zero timing and exact ties', () => {
    expect(
      gaps([driver(0, { delta: 0 }), driver(1, { delta: 0 })], {
        pct: [0.5, 0.5],
        est: [0, 0],
      }).map((d) => d.gap?.value)
    ).toEqual([0, 0]);
  });

  it('does not turn a start/finish crossing into a lap difference', () => {
    const result = gaps([driver(0), driver(1), driver(2)], {
      laps: [6, 5, 5],
      pct: [0.01, 0.99, 0.9],
      est: [1, 99, 90],
    });
    expect(result.map((d) => d.gap)).toEqual([
      { value: -2, laps: 0 },
      { value: 0, laps: 0 },
      { value: 9, laps: 0 },
    ]);
  });

  it('keeps race direction more than half a lap apart and signs lap differences', () => {
    const result = gaps([driver(0), driver(1), driver(2)], {
      laps: [7, 5, 4],
      pct: [0.2, 0.5, 0.1],
      est: [20, 50, 10],
    });
    expect(result.map((d) => d.gap)).toEqual([
      { value: -70, laps: -1 },
      { value: 0, laps: 0 },
      { value: 40, laps: 1 },
    ]);
  });

  it('uses the chasing class estimate in multiclass pit fallback', () => {
    const result = gaps(
      [
        driver(0, {
          carClass: { id: 2, estLapTime: 80 } as Standings['carClass'],
        }),
        driver(1),
      ],
      { pits: [true, false], est: [72, 50] }
    );
    expect(result.find((d) => d.carIdx === 0)?.gap).toEqual({
      value: -40,
      laps: 0,
    });
  });

  it('interpolates the chasing car reference lap when available', () => {
    const lap: ReferenceLap = {
      startTime: 0,
      finishTime: 100,
      times: new Float32Array([0, 25, 50, 75]),
      pointPos: new Float32Array([0, 0.25, 0.5, 0.75]),
      tangents: new Float32Array([100, 100, 100, 100]),
      interval: 0.25,
      pointsCount: 4,
      lastTrackedPct: 1,
      isCleanLap: true,
    };
    useReferenceLapStore.setState({
      bestLaps: new Map([
        [1, lap],
        [2, lap],
      ]),
    });
    const result = gaps(
      [driver(0, { lap: 5 }), driver(1, { lap: 5 }), driver(2, { lap: 5 })],
      { pct: [0.6, 0.5, 0.4] }
    );
    expect(result[0].gap?.value).toBeCloseTo(-10);
    expect(result[2].gap?.value).toBeCloseTo(10);
  });

  it('leaves unavailable opponent/reference timing blank and self at zero', () => {
    for (const players of [
      [driver(0, { onTrack: false }), driver(1)],
      [driver(0), driver(1, { onTrack: false })],
    ])
      expect(gaps(players).map((d) => d.gap?.value)).toEqual([undefined, 0]);
    expect(gaps([driver(0)]).map((d) => d.gap?.value)).toEqual([undefined]);
  });

  it('leaves a missing estimate blank without a reference lap', () => {
    expect(
      gaps([driver(0), driver(1)], { est: [-1, 50] })[0].gap?.value
    ).toBeUndefined();
  });

  it('hides unavailable positions rather than displaying an invented lap gap', () => {
    expect(gaps([driver(0), driver(1)], { pct: [-1, 0.5] })[0].gap).toEqual({
      value: undefined,
      laps: 0,
    });
  });

  it.each(['Practice', 'Qualify'])(
    'compares best laps in %s even in the pits',
    (session) => {
      const result = gaps(
        [
          driver(0, { onTrack: false }),
          driver(1, { onTrack: false }),
          driver(2, { fastestTime: -1 }),
        ],
        { session }
      );
      expect(result.map((d) => d.gap?.value)).toEqual([-1, 0, undefined]);
    }
  );
});
