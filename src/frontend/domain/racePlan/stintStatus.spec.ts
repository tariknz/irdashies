import { describe, expect, it } from 'vitest';
import type { RacePlanStop, RacePlanStrategy } from '@irdashies/types';
import {
  boxLabel,
  boxState,
  describeStop,
  driftLevel,
  driftText,
  fuelLevel,
  fuelTargetPerLap,
  planStint,
  recentUnplannedStops,
} from './stintStatus';

describe('boxState', () => {
  it('is box now on the box lap and counts down before it', () => {
    expect(boxState({ boxLap: 40, lapsUntilBox: 0 })).toEqual({
      kind: 'box-now',
    });
    expect(boxState({ boxLap: 40, lapsUntilBox: 1 })).toEqual({
      kind: 'box-in',
      laps: 1,
    });
  });

  it('is unknown without a box lap', () => {
    expect(boxState({ boxLap: null, lapsUntilBox: null })).toEqual({
      kind: 'unknown',
    });
    expect(boxState({ boxLap: 40, lapsUntilBox: null }).kind).toBe('unknown');
    expect(boxState({ boxLap: 40, lapsUntilBox: -1 }).kind).toBe('unknown');
  });

  it('labels each state', () => {
    expect(boxLabel({ kind: 'box-now' })).toBe('Box this lap');
    expect(boxLabel({ kind: 'box-in', laps: 3 })).toBe('Box in 3');
    expect(boxLabel({ kind: 'unknown' })).toBe('Box lap unknown');
  });
});

describe('drift', () => {
  it('reads behind, ahead or on plan', () => {
    expect(driftText(134)).toBe('+2:14 behind plan');
    expect(driftText(-45)).toBe('-0:45 ahead of plan');
    expect(driftText(0.4)).toBe('On plan');
    expect(driftText(3600 + 62)).toBe('+1:01:02 behind plan');
  });

  it('is null when unknown', () => {
    expect(driftText(null)).toBeNull();
    expect(driftText(Number.NaN)).toBeNull();
  });

  it('gives a level for colouring', () => {
    expect(driftLevel(10)).toBe('behind');
    expect(driftLevel(-10)).toBe('ahead');
    expect(driftLevel(0)).toBe('on-plan');
  });
});

describe('fuel target', () => {
  const strategy = {
    stints: [
      { number: 1, laps: 34, fuel: 35.7 },
      { number: 2, laps: 34, fuel: null },
    ],
  } as unknown as RacePlanStrategy;

  it('finds the plan stint by number', () => {
    expect(planStint(strategy, 2)?.number).toBe(2);
    expect(planStint(strategy, 9)).toBeNull();
    expect(planStint(strategy, null)).toBeNull();
    expect(planStint(null, 1)).toBeNull();
  });

  it('is the stint fuel over its laps', () => {
    expect(fuelTargetPerLap({ fuel: 35.7, laps: 34 })).toBeCloseTo(1.05, 5);
  });

  it('is null without fuel or laps', () => {
    expect(fuelTargetPerLap({ fuel: null, laps: 34 })).toBeNull();
    expect(fuelTargetPerLap({ fuel: 0, laps: 34 })).toBeNull();
    expect(fuelTargetPerLap({ fuel: 35.7, laps: 0 })).toBeNull();
    expect(fuelTargetPerLap(null)).toBeNull();
  });

  it('compares the actual use at the shown precision', () => {
    expect(fuelLevel(1.05, 1.054)).toBe('on-target');
    expect(fuelLevel(1.05, 1.02)).toBe('on-target');
    expect(fuelLevel(1.05, 1.07)).toBe('over');
    expect(fuelLevel(null, 1.07)).toBe('unknown');
    expect(fuelLevel(1.05, null)).toBe('unknown');
  });
});

const stop = (
  lap: number,
  extra: Partial<RacePlanStop> = {}
): RacePlanStop => ({
  lap,
  elapsedSec: lap * 100,
  durationSec: 45,
  fuelAdded: 20,
  fuelAssumed: false,
  driverChanged: false,
  compoundChanged: false,
  unplanned: true,
  ...extra,
});

describe('stops', () => {
  it('describes a stop', () => {
    expect(describeStop(stop(147))).toBe(
      'Stop lap 147: fuel, no driver change'
    );
    expect(describeStop(stop(90, { fuelAdded: 0, driverChanged: true }))).toBe(
      'Stop lap 90: no fuel, driver change'
    );
    expect(
      describeStop(stop(12, { fuelAdded: null, compoundChanged: true }))
    ).toBe('Stop lap 12: fuel unknown, no driver change, tyre change');
    expect(describeStop(stop(12, { fuelAdded: null, fuelAssumed: true }))).toBe(
      'Stop lap 12: fuel (assumed), no driver change'
    );
  });

  it('lists recent unplanned stops, newest first', () => {
    const stops = [
      stop(10),
      stop(20, { unplanned: false }),
      stop(30),
      stop(40),
    ];
    expect(recentUnplannedStops(stops).map((s) => s.lap)).toEqual([40, 30, 10]);
    expect(recentUnplannedStops(stops, 2).map((s) => s.lap)).toEqual([40, 30]);
  });
});
