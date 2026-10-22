import { describe, expect, it } from 'vitest';
import type {
  RacePlanProjectedStint,
  RacePlanStint,
  RacePlanStrategy,
} from '@irdashies/types';
import { rawPlanningFixture } from '../services/racePlanFixture';
import { normalizeRacePlanning } from '../services/racePlanNormalize';
import {
  FUEL_MARGIN_LAPS,
  MAX_PROJECTED_STINTS,
  lapsOnFuel,
  plannedElapsedAtLap,
  rebaselinePlan,
  type RebaselineActualStint,
  type RebaselineInput,
} from './racePlanRebaseline';

const fixtureStrategy = (): RacePlanStrategy => {
  const planning = normalizeRacePlanning(rawPlanningFixture());
  if (!planning) throw new Error('fixture did not normalise');
  return planning.strategies[0];
};

const STRATEGY = fixtureStrategy();
const STINT_SEC = 61 * 60;
const CYCLE_SEC = STINT_SEC + 50;
const PLAN_END = 22 * CYCLE_SEC + STINT_SEC;
const FIRST_LAP_SEC = STINT_SEC / 33;
const LAP_SEC = STINT_SEC / 34;
const PLAN_START_LAPS = STRATEGY.stints.map((_, i) =>
  i === 0 ? 0 : 33 + (i - 1) * 34
);

const plannedAt = (lap: number): number => {
  const sec = plannedElapsedAtLap(STRATEGY, lap);
  if (sec === null) throw new Error('no planned time');
  return sec;
};

const makeInput = (overrides: Partial<RebaselineInput>): RebaselineInput => ({
  strategy: STRATEGY,
  actual: [],
  teamLaps: 0,
  elapsedSec: 0,
  remainingSec: null,
  fuelLevel: null,
  tankCapacity: null,
  fuelPerLap: null,
  lapTimeSec: null,
  conditions: 'dry',
  ...overrides,
});

/** Actual history that followed the plan up to the start of stint `index`. */
const onPlanHistory = (index: number): RebaselineActualStint[] =>
  STRATEGY.stints.slice(0, index + 1).map((stint, i) => ({
    driverId: stint.driverId,
    startLap: PLAN_START_LAPS[i],
    startSec: stint.startSec,
    endLap: i < index ? PLAN_START_LAPS[i] + stint.laps : null,
    endSec: i < index ? stint.endSec : null,
    planIndex: i,
    fueled: true,
  }));

const ran = (
  driverId: number | null,
  planIndex: number,
  startLap: number,
  startSec: number,
  end: { lap: number; sec: number } | null = null,
  fueled = true
): RebaselineActualStint => ({
  driverId,
  startLap,
  startSec,
  endLap: end ? end.lap : null,
  endSec: end ? end.sec : null,
  planIndex,
  fueled,
});

const expectMatchesPlan = (stints: RacePlanProjectedStint[], fromIndex = 0) => {
  expect(stints).toHaveLength(STRATEGY.stints.length);
  STRATEGY.stints.forEach((planned, i) => {
    if (i < fromIndex) return;
    const stint = stints[i];
    expect(stint.number).toBe(i + 1);
    expect(stint.planNumber).toBe(planned.number);
    expect(stint.driverId).toBe(planned.driverId);
    expect(stint.startLap).toBe(PLAN_START_LAPS[i]);
    expect(stint.laps).toBe(planned.laps);
    expect(stint.startSec).toBeCloseTo(planned.startSec, 1);
    expect(stint.endSec).toBeCloseTo(planned.endSec, 1);
    expect(stint.rebuilt).toBe(false);
    expect(stint.status).not.toBe('dropped');
  });
};

const planStint = (
  number: number,
  driverId: number | null,
  startSec: number,
  laps: number,
  lapSec: number
): RacePlanStint => ({
  number,
  driverId,
  startSec,
  endSec: startSec + laps * lapSec,
  laps,
  setup: 'dry',
  fuel: null,
  locked: false,
});

/** Three 20-lap stints at 100 s a lap, a 60 s stop and a 50 L tank. */
const smallStrategy = (
  drivers: (number | null)[] = [101, 102, 103]
): RacePlanStrategy => ({
  id: 1,
  name: 'Small',
  raceStartMs: 0,
  fuelCapacity: 50,
  pitStopMs: 60_000,
  updatedAt: '2030-01-01T00:00:00Z',
  drivers: [101, 102, 103].map((iracingId) => ({
    iracingId,
    avgLapMsDry: 100_000,
    avgLapMsWet: null,
    fuelPerLapDry: 2.4,
    fuelPerLapWet: null,
  })),
  stints: drivers.map((driverId, i) =>
    planStint(i + 1, driverId, i * 2060, 20, 100)
  ),
});

describe('lapsOnFuel', () => {
  it('keeps a margin of a fraction of a lap', () => {
    expect(FUEL_MARGIN_LAPS).toBe(0.3);
    expect(lapsOnFuel(36, 1.05)).toBe(33);
    expect(lapsOnFuel(10.3, 1)).toBe(10);
    expect(lapsOnFuel(10.2, 1)).toBe(9);
    expect(lapsOnFuel(0, 1)).toBe(0);
  });
});

describe('rebaselinePlan before the green flag', () => {
  it('returns the plan as it is', () => {
    const result = rebaselinePlan(makeInput({}));

    expect(result.boxLap).toBeNull();
    expect(result.driftSec).toBeNull();
    expectMatchesPlan(result.stints);
    expect(result.stints[0].status).toBe('upcoming');
    expect(result.stints[22].status).toBe('unassigned');
  });
});

describe('rebaselinePlan when the race runs to plan', () => {
  it('reproduces the plan at the green flag', () => {
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(0),
        remainingSec: PLAN_END,
        fuelLevel: 36,
      })
    );

    expect(result.boxLap).toBe(33);
    expect(result.driftSec).toBe(0);
    expectMatchesPlan(result.stints);
    expect(result.stints[0].status).toBe('current');
    expect(result.stints.slice(1, 22).map((s) => s.status)).toEqual(
      Array(21).fill('upcoming')
    );
    expect(result.stints[22].status).toBe('unassigned');
  });

  it('reproduces the plan mid-stint with measured figures equal to the plan', () => {
    const elapsedSec = CYCLE_SEC + 17 * LAP_SEC;
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(1),
        teamLaps: 50,
        elapsedSec,
        remainingSec: PLAN_END - elapsedSec,
        fuelLevel: 36 - 17 * 1.05,
        fuelPerLap: 1.05,
        lapTimeSec: LAP_SEC,
      })
    );

    expect(result.boxLap).toBe(67);
    expect(result.driftSec).toBeCloseTo(0, 2);
    expectMatchesPlan(result.stints);
    expect(result.stints[0].status).toBe('done');
    expect(result.stints[1].status).toBe('current');
  });

  it('has no off-by-one drift at any stint start', () => {
    STRATEGY.stints.forEach((planned, index) => {
      const result = rebaselinePlan(
        makeInput({
          actual: onPlanHistory(index),
          teamLaps: PLAN_START_LAPS[index],
          elapsedSec: planned.startSec,
          remainingSec: PLAN_END - planned.startSec,
          fuelLevel: 36,
        })
      );
      expect(result.driftSec).toBeCloseTo(0, 2);
      expectMatchesPlan(result.stints, index);
      expect(result.stints[index].status).toBe('current');
    });
  });

  it('has no drift on any lap of a stint', () => {
    for (let lap = 33; lap <= 67; lap++) {
      const elapsedSec = CYCLE_SEC + (lap - 33) * LAP_SEC;
      const result = rebaselinePlan(
        makeInput({
          actual: onPlanHistory(1),
          teamLaps: lap,
          elapsedSec,
          remainingSec: PLAN_END - elapsedSec,
        })
      );
      expect(result.driftSec).toBeCloseTo(0, 2);
      expect(result.boxLap).toBe(67);
    }
  });

  it('has no drift on the box lap before the stop', () => {
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(0),
        teamLaps: 33,
        elapsedSec: STINT_SEC,
        remainingSec: PLAN_END - STINT_SEC,
        fuelLevel: 36 - 33 * 1.05,
      })
    );
    expect(result.driftSec).toBeCloseTo(0, 2);
    expect(result.boxLap).toBe(33);
    expect(plannedAt(33)).toBeCloseTo(STINT_SEC, 6);
    expect(plannedElapsedAtLap(STRATEGY, 33, true)).toBeCloseTo(CYCLE_SEC, 6);
  });

  it('needs no box lap when the current stint runs to the finish', () => {
    const start = STRATEGY.stints[22].startSec;
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(22),
        teamLaps: PLAN_START_LAPS[22],
        elapsedSec: start,
        remainingSec: PLAN_END - start,
        fuelLevel: 36,
      })
    );

    expect(result.boxLap).toBeNull();
    expect(result.stints[22].laps).toBe(34);
    expect(result.stints[22].rebuilt).toBe(false);
  });
});

describe('rebaselinePlan after a repair stop with no fuel', () => {
  const repairSec = 600;
  const elapsedSec = plannedAt(20) + repairSec;
  const base = {
    actual: onPlanHistory(0),
    teamLaps: 20,
    elapsedSec,
    remainingSec: PLAN_END - elapsedSec,
    fuelLevel: 36 - 20 * 1.05,
  };

  it('keeps the box lap and moves later stints on the clock', () => {
    const result = rebaselinePlan(makeInput(base));

    expect(result.boxLap).toBe(33);
    expect(plannedAt(20)).toBeCloseTo(20 * FIRST_LAP_SEC, 6);
    expect(result.driftSec).toBeCloseTo(repairSec, 1);
    expect(result.stints[0].endSec).toBeCloseTo(STINT_SEC + repairSec, 1);
    expect(result.stints[0].rebuilt).toBe(false);
    for (let i = 1; i < 22; i++) {
      expect(result.stints[i].startSec).toBeCloseTo(
        STRATEGY.stints[i].startSec + repairSec,
        1
      );
      expect(result.stints[i].laps).toBe(34);
      expect(result.stints[i].rebuilt).toBe(false);
    }
  });

  it('cuts the last stint to the race time left', () => {
    const result = rebaselinePlan(makeInput(base));
    const last = result.stints[22];

    expect(result.stints).toHaveLength(23);
    expect(last.laps).toBe(29);
    expect(last.rebuilt).toBe(true);
    expect(last.status).toBe('unassigned');
    expect(last.endSec).toBeGreaterThanOrEqual(PLAN_END);
  });

  it('drops a planned stint that no longer fits after a very long repair', () => {
    const longSec = plannedAt(20) + 70 * 60;
    const result = rebaselinePlan(
      makeInput({
        ...base,
        elapsedSec: longSec,
        remainingSec: PLAN_END - longSec,
      })
    );

    expect(result.stints).toHaveLength(23);
    expect(result.stints[21].status).toBe('upcoming');
    expect(result.stints[21].laps).toBe(30);
    expect(result.stints[21].endSec).toBeGreaterThanOrEqual(PLAN_END);
    expect(result.stints[22].status).toBe('dropped');
    expect(result.stints[22].number).toBe(23);
    expect(result.stints[22].planNumber).toBe(23);
    expect(result.stints[22].startSec).toBe(STRATEGY.stints[22].startSec);
  });
});

describe('rebaselinePlan after a damage stop with fuel added', () => {
  const stopEnd = plannedAt(20) + 300;
  const result = rebaselinePlan(
    makeInput({
      actual: [
        ran(101, 0, 0, 0, { lap: 20, sec: plannedAt(20) }),
        ran(102, 1, 20, stopEnd),
      ],
      teamLaps: 20,
      elapsedSec: stopEnd,
      remainingSec: PLAN_END - stopEnd,
      fuelLevel: 36,
    })
  );

  it('starts a new stint from the stop lap', () => {
    expect(result.stints[0]).toMatchObject({
      number: 1,
      planNumber: 1,
      status: 'done',
      laps: 20,
      rebuilt: true,
    });
    expect(result.stints[1]).toMatchObject({
      number: 2,
      planNumber: 2,
      driverId: 102,
      status: 'current',
      startLap: 20,
      laps: 34,
      rebuilt: true,
    });
    expect(result.boxLap).toBe(54);
  });

  it('moves every later stop by laps', () => {
    for (let i = 2; i < 23; i++) {
      expect(result.stints[i].startLap).toBe(54 + (i - 2) * 34);
      expect(result.stints[i].driverId).toBe(STRATEGY.stints[i].driverId);
    }
  });

  it('adds an unassigned stint when the race needs one more', () => {
    const extra = result.stints[23];

    expect(result.stints).toHaveLength(24);
    expect(extra).toMatchObject({
      number: 24,
      planNumber: null,
      driverId: null,
      plannedStartSec: null,
      plannedEndSec: null,
      status: 'unassigned',
      rebuilt: true,
    });
    expect(extra.laps).toBeGreaterThan(0);
    expect(extra.endSec).toBeGreaterThanOrEqual(PLAN_END);
  });

  it('keeps the double stint in the plan', () => {
    expect(result.stints[1].driverId).toBe(102);
    expect(result.stints[2].driverId).toBe(102);
    expect(result.stints[2].startLap).toBe(54);
    expect(result.stints[3].driverId).toBe(103);
  });
});

describe('rebaselinePlan after a long repair with a driver swap', () => {
  const stopEnd = plannedAt(20) + 900;
  const result = rebaselinePlan(
    makeInput({
      actual: [
        ran(101, 0, 0, 0, { lap: 20, sec: plannedAt(20) }),
        ran(102, 1, 20, stopEnd, null, false),
      ],
      teamLaps: 20,
      elapsedSec: stopEnd,
      remainingSec: PLAN_END - stopEnd,
      fuelLevel: 36 - 20 * 1.05,
    })
  );

  it('brings the next planned driver in early on the same tank', () => {
    const current = result.stints[1];

    expect(current.driverId).toBe(102);
    expect(current.startSec).toBeLessThan(STRATEGY.stints[1].startSec);
    expect(result.boxLap).toBe(20 + lapsOnFuel(15, 1.05));
    expect(current.laps).toBe(13);
    expect(current.rebuilt).toBe(true);
  });

  it('rebuilds the later stints from the box lap', () => {
    expect(result.stints[2]).toMatchObject({
      number: 3,
      planNumber: 3,
      driverId: 102,
      startLap: 33,
      laps: 34,
      rebuilt: true,
    });
    const last = result.stints[result.stints.length - 1];
    expect(last.endSec).toBeGreaterThanOrEqual(PLAN_END);
  });
});

describe('rebaselinePlan after a partial fill', () => {
  it('takes the box lap from the fuel in the car', () => {
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(1),
        teamLaps: 33,
        elapsedSec: CYCLE_SEC,
        remainingSec: PLAN_END - CYCLE_SEC,
        fuelLevel: 20,
      })
    );

    expect(result.boxLap).toBe(33 + lapsOnFuel(20, 1.05));
    expect(result.boxLap).toBe(51);
    expect(result.stints[1]).toMatchObject({ laps: 18, rebuilt: true });
    expect(result.stints[1].endSec).toBeCloseTo(CYCLE_SEC + 18 * LAP_SEC, 1);
    expect(result.stints[2]).toMatchObject({
      number: 3,
      planNumber: 3,
      driverId: 102,
      startLap: 51,
      laps: 34,
    });
  });
});

describe('rebaselinePlan in the wet', () => {
  const wet = rebaselinePlan(
    makeInput({
      actual: onPlanHistory(1),
      teamLaps: 33,
      elapsedSec: CYCLE_SEC,
      remainingSec: PLAN_END - CYCLE_SEC,
      fuelLevel: 36,
      fuelPerLap: 1.15,
      lapTimeSec: 125,
      conditions: 'wet',
    })
  );

  it('fits fewer laps in a tank when wet tyres use more fuel', () => {
    expect(lapsOnFuel(36, 1.15)).toBe(31);
    expect(wet.boxLap).toBe(64);
    expect(wet.stints[1].laps).toBe(31);
    expect(wet.stints[2]).toMatchObject({ startLap: 64, laps: 31 });
  });

  it('makes each stint longer on the clock', () => {
    const next = wet.stints[2];
    expect(next.endSec - next.startSec).toBeCloseTo(31 * 125, 1);
    expect(next.endSec - next.startSec).toBeGreaterThan(STINT_SEC);
    expect(wet.stints[1].endSec).toBeGreaterThan(STRATEGY.stints[1].endSec);
  });

  it('marks the current and later stints wet', () => {
    const active = wet.stints.filter((s) => s.status !== 'done');
    expect(active.filter((s) => s.status !== 'dropped').length).toBeGreaterThan(
      0
    );
    active
      .filter((s) => s.status !== 'dropped')
      .forEach((s) => expect(s.setup).toBe('wet'));
    expect(wet.stints[0].setup).toBe('dry');
  });

  it('drops planned stints that no longer fit', () => {
    expect(wet.stints).toHaveLength(23);
    expect(wet.stints[22].status).toBe('dropped');
    const active = wet.stints.filter((s) => s.status !== 'dropped');
    expect(active[active.length - 1].endSec).toBeGreaterThanOrEqual(PLAN_END);
  });

  it('uses the plan wet pace when given and never assumes less fuel', () => {
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(0),
        remainingSec: PLAN_END,
        fuelLevel: 36,
        conditions: 'wet',
      })
    );

    expect(result.boxLap).toBe(33);
    expect(result.stints[0].endSec).toBeCloseTo(33 * 121, 1);
    expect(result.stints[1].laps).toBe(34);
    expect(result.stints[1].setup).toBe('wet');
  });
});

describe('rebaselinePlan back on slicks', () => {
  it('goes back to the plan dry figures', () => {
    const wetEnd = CYCLE_SEC + 31 * 125;
    const startSec = wetEnd + 50;
    const result = rebaselinePlan(
      makeInput({
        actual: [
          ran(101, 0, 0, 0, { lap: 33, sec: STINT_SEC }),
          ran(102, 1, 33, CYCLE_SEC, { lap: 64, sec: wetEnd }),
          ran(102, 2, 64, startSec),
        ],
        teamLaps: 64,
        elapsedSec: startSec,
        remainingSec: PLAN_END - startSec,
        fuelLevel: 36,
      })
    );

    expect(result.stints[1]).toMatchObject({ status: 'done', laps: 31 });
    expect(result.boxLap).toBe(98);
    expect(result.stints[2]).toMatchObject({
      status: 'current',
      laps: 34,
      setup: 'dry',
    });
    expect(result.stints[2].endSec).toBeCloseTo(startSec + STINT_SEC, 1);
    expect(result.stints[3]).toMatchObject({
      startLap: 98,
      laps: 34,
      setup: 'dry',
    });
    expect(result.stints[3].endSec - result.stints[3].startSec).toBeCloseTo(
      STINT_SEC,
      1
    );
  });
});

describe('rebaselinePlan race end', () => {
  it('uses the plan end when the time left is unknown', () => {
    const known = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(0),
        remainingSec: PLAN_END,
        fuelLevel: 36,
      })
    );
    const unknown = rebaselinePlan(
      makeInput({ actual: onPlanHistory(0), fuelLevel: 36 })
    );

    expect(unknown).toEqual(known);
  });

  it('adds an unassigned stint when the race runs longer than the plan', () => {
    const result = rebaselinePlan(
      makeInput({
        actual: onPlanHistory(0),
        remainingSec: PLAN_END + 2000,
        fuelLevel: 36,
      })
    );

    expect(result.stints).toHaveLength(24);
    expect(result.stints[22].laps).toBe(34);
    expect(result.stints[23]).toMatchObject({
      number: 24,
      planNumber: null,
      driverId: null,
      status: 'unassigned',
      startLap: 33 + 22 * 34,
    });
  });
});

describe('rebaselinePlan with a stint that has no driver', () => {
  it('shows it as unassigned', () => {
    const strategy = smallStrategy([101, null, 103]);
    const result = rebaselinePlan(
      makeInput({
        strategy,
        actual: [ran(101, 0, 0, 0)],
        remainingSec: 6120,
        fuelLevel: 50,
      })
    );

    expect(result.stints.map((s) => s.status)).toEqual([
      'current',
      'unassigned',
      'upcoming',
    ]);
    expect(result.stints[1].driverId).toBeNull();
    expect(result.stints.map((s) => s.startLap)).toEqual([0, 20, 40]);
    expect(result.stints[2].startSec).toBeCloseTo(4120, 1);
    expect(result.stints.every((s) => !s.rebuilt)).toBe(true);
  });
});

describe('rebaselinePlan with bad inputs', () => {
  const actual = onPlanHistory(0);
  const clean = rebaselinePlan(
    makeInput({ actual, remainingSec: PLAN_END, fuelLevel: 36 })
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores a measured fuel per lap or lap time of %s',
    (bad) => {
      const result = rebaselinePlan(
        makeInput({
          actual,
          remainingSec: PLAN_END,
          fuelLevel: 36,
          fuelPerLap: bad,
          lapTimeSec: bad,
          tankCapacity: bad,
        })
      );
      expect(result).toEqual(clean);
    }
  );

  it('treats an unreadable fuel level as unknown', () => {
    const result = rebaselinePlan(
      makeInput({ actual, remainingSec: PLAN_END, fuelLevel: Number.NaN })
    );
    expect(result.boxLap).toBe(33);
    expect(result.stints).toEqual(clean.stints);
  });

  it('stays finite with unreadable times', () => {
    const result = rebaselinePlan(
      makeInput({
        actual,
        teamLaps: Number.NaN,
        elapsedSec: Number.NaN,
        remainingSec: Number.NaN,
      })
    );
    result.stints.forEach((s) => {
      expect(Number.isFinite(s.startSec)).toBe(true);
      expect(Number.isFinite(s.endSec)).toBe(true);
    });
    expect(result.driftSec).toBe(0);
  });

  it('never returns more than the stint cap', () => {
    const result = rebaselinePlan(
      makeInput({ actual, remainingSec: 1e9, fuelLevel: 36 })
    );
    expect(result.stints).toHaveLength(MAX_PROJECTED_STINTS);
  });

  it('copes with a plan that has no stints or figures', () => {
    const result = rebaselinePlan(
      makeInput({
        strategy: {
          ...STRATEGY,
          stints: [],
          drivers: [],
          fuelCapacity: null,
          pitStopMs: null,
        },
        actual,
        remainingSec: 7200,
      })
    );
    expect(result.stints.length).toBeGreaterThan(0);
    expect(result.stints.length).toBeLessThanOrEqual(MAX_PROJECTED_STINTS);
    expect(result.driftSec).toBeNull();
    expect(result.stints[0].number).toBe(1);
    expect(result.stints[1].number).toBe(2);
  });

  it('copes with plan stints of zero laps', () => {
    const strategy = smallStrategy();
    strategy.stints = strategy.stints.map((s) => ({ ...s, laps: 0 }));
    const result = rebaselinePlan(
      makeInput({ strategy, actual, remainingSec: 6000, fuelLevel: 50 })
    );
    expect(result.stints.length).toBeLessThanOrEqual(MAX_PROJECTED_STINTS);
    expect(result.stints.every((s) => s.laps > 0)).toBe(true);
  });
});

describe('rebaselinePlan after an unplanned fuel stop with no driver change', () => {
  it('keeps the plan driver order and the double stint', () => {
    const result = rebaselinePlan(
      makeInput({
        strategy: smallStrategy([101, 102, 102, 103]),
        actual: [ran(101, 0, 0, 0, { lap: 8, sec: 800 }), ran(101, 0, 8, 860)],
        teamLaps: 8,
        elapsedSec: 860,
        remainingSec: 8180 - 860,
        fuelLevel: 50,
      })
    );

    expect(result.boxLap).toBe(28);
    expect(result.stints.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(result.stints.map((s) => s.planNumber)).toEqual([1, 1, 2, 3, 4]);
    expect(result.stints.map((s) => s.driverId)).toEqual([
      101, 101, 102, 102, 103,
    ]);
    expect(result.stints.map((s) => s.status)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(result.stints[0].rebuilt).toBe(true);
    expect(result.stints[1]).toMatchObject({
      startLap: 8,
      laps: 20,
      rebuilt: true,
      plannedStartSec: 0,
    });
    expect(result.stints[2].startLap).toBe(28);
  });

  it('carries on with the next planned driver in a plain rotation', () => {
    const splitLap = PLAN_START_LAPS[3] + 10;
    const splitSec = plannedAt(splitLap);
    const history = onPlanHistory(3);
    history[3] = ran(103, 3, PLAN_START_LAPS[3], STRATEGY.stints[3].startSec, {
      lap: splitLap,
      sec: splitSec,
    });
    const result = rebaselinePlan(
      makeInput({
        actual: [...history, ran(103, 3, splitLap, splitSec + 60)],
        teamLaps: splitLap,
        elapsedSec: splitSec + 60,
        remainingSec: PLAN_END - splitSec - 60,
        fuelLevel: 36,
      })
    );

    expect(result.stints[4]).toMatchObject({
      number: 5,
      planNumber: 4,
      driverId: 103,
      status: 'current',
      startLap: splitLap,
      laps: 34,
      rebuilt: true,
    });
    expect(result.stints[5]).toMatchObject({
      number: 6,
      planNumber: 5,
      driverId: STRATEGY.stints[4].driverId,
      startLap: splitLap + 34,
    });
    result.stints.forEach((s, i) => expect(s.number).toBe(i + 1));
    const planNumbers = result.stints
      .map((s) => s.planNumber)
      .filter((n): n is number => n !== null);
    expect(planNumbers.slice(5)).toEqual(
      STRATEGY.stints.slice(4).map((s) => s.number)
    );
  });
});

describe('rebaselinePlan after a driver swap with no fuel', () => {
  const swapEnd = plannedAt(20) + 60;
  const swapInput = (fueled: boolean) =>
    makeInput({
      actual: [
        ran(101, 0, 0, 0, { lap: 20, sec: plannedAt(20) }),
        ran(102, 1, 20, swapEnd, null, fueled),
      ],
      teamLaps: 20,
      elapsedSec: swapEnd,
      remainingSec: PLAN_END - swapEnd,
      fuelLevel: null,
    });

  it('keeps the box lap of the tank in the car when fuel is not visible', () => {
    const result = rebaselinePlan(swapInput(false));

    expect(result.boxLap).toBe(33);
    expect(result.stints[1]).toMatchObject({
      planNumber: 2,
      driverId: 102,
      laps: 13,
    });
    expect(result.stints[2]).toMatchObject({
      planNumber: 3,
      driverId: 102,
      startLap: 33,
    });
  });

  it('gives a fueled swap a full tank', () => {
    expect(rebaselinePlan(swapInput(true)).boxLap).toBe(54);
  });
});

describe('rebaselinePlan once the race is finished', () => {
  it('shows no more stints to run and drops the rest of the plan', () => {
    const history = onPlanHistory(20);
    const endLap = PLAN_START_LAPS[20] + 34;
    const endSec = STRATEGY.stints[20].endSec;
    history[20] = { ...history[20], endLap, endSec };
    const result = rebaselinePlan(
      makeInput({
        actual: history,
        teamLaps: endLap,
        elapsedSec: endSec,
        remainingSec: 0,
      })
    );

    expect(result.boxLap).toBeNull();
    expect(result.stints).toHaveLength(23);
    expect(result.stints.slice(0, 21).every((s) => s.status === 'done')).toBe(
      true
    );
    expect(result.stints.slice(21).map((s) => s.status)).toEqual([
      'dropped',
      'dropped',
    ]);
    expect(
      result.stints.some(
        (s) => s.status === 'upcoming' || s.status === 'unassigned'
      )
    ).toBe(false);
  });
});

describe('rebaselinePlan pace for later stints', () => {
  const strategy: RacePlanStrategy = {
    ...smallStrategy(),
    drivers: [
      {
        iracingId: 101,
        avgLapMsDry: 100_000,
        avgLapMsWet: null,
        fuelPerLapDry: 2.4,
        fuelPerLapWet: null,
      },
      {
        iracingId: 102,
        avgLapMsDry: 110_000,
        avgLapMsWet: null,
        fuelPerLapDry: 2.4,
        fuelPerLapWet: null,
      },
    ],
    stints: [
      planStint(1, 101, 0, 20, 100),
      planStint(2, 102, 2060, 20, 110),
      planStint(3, 101, 4320, 20, 100),
    ],
  };
  const result = rebaselinePlan(
    makeInput({
      strategy,
      actual: [ran(101, 0, 0, 0)],
      remainingSec: 12_000,
      fuelLevel: 50,
      lapTimeSec: 105,
    })
  );
  const duration = (s: RacePlanProjectedStint) => s.endSec - s.startSec;

  it('uses the measured lap for the current driver', () => {
    expect(duration(result.stints[0])).toBeCloseTo(20 * 105, 1);
  });

  it('scales each planned driver by the measured correction', () => {
    expect(duration(result.stints[1])).toBeCloseTo(20 * 110 * 1.05, 1);
    expect(duration(result.stints[2])).toBeCloseTo(20 * 105, 1);
  });

  it('uses the measured lap for an extra stint with no figures', () => {
    expect(result.stints[3].planNumber).toBeNull();
    expect(duration(result.stints[3])).toBeCloseTo(
      result.stints[3].laps * 105,
      1
    );
  });
});
