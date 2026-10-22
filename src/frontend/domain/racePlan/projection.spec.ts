import { describe, expect, it } from 'vitest';
import type {
  RacePlanProjectedStint,
  RacePlanState,
  RacePlanning,
} from '@irdashies/types';
import {
  UNASSIGNED_DRIVER,
  UNKNOWN_DRIVER,
  currentStint,
  driverName,
  elapsedToEpochMs,
  findMyNextStint,
  formatClock,
  formatCountdown,
  formatElapsed,
  formatRaceTime,
  myNextStintText,
  nextStint,
  plannedStintCount,
  selectStrategy,
} from './projection';

const START = Date.parse('2030-06-01T12:00:00Z');

const stint = (
  number: number,
  driverId: number | null,
  status: RacePlanProjectedStint['status'],
  startSec = (number - 1) * 3600
): RacePlanProjectedStint => ({
  number,
  planNumber: number,
  driverId,
  plannedStartSec: startSec,
  plannedEndSec: startSec + 3600,
  startSec,
  endSec: startSec + 3600,
  startLap: (number - 1) * 30,
  laps: 30,
  status,
  setup: 'dry',
  rebuilt: false,
});

const planning = {
  drivers: [
    { iracingId: 101, name: 'Driver A', availability: [] },
    { iracingId: 102, name: 'Driver B', availability: [] },
  ],
  strategies: [
    { id: 1, stints: [] },
    { id: 2, stints: [] },
  ],
} as unknown as RacePlanning;

describe('elapsedToEpochMs', () => {
  it('adds the elapsed time to the race start', () => {
    expect(elapsedToEpochMs(START, 90)).toBe(START + 90_000);
  });

  it('is null without a race start', () => {
    expect(elapsedToEpochMs(null, 90)).toBeNull();
    expect(elapsedToEpochMs(undefined, 90)).toBeNull();
  });
});

describe('formatClock', () => {
  it('wraps past midnight', () => {
    const at = elapsedToEpochMs(START, 12 * 3600 + 42 * 60) as number;
    expect(formatClock(at, 'UTC')).toBe('00:42');
  });

  it('follows a DST change in the local zone', () => {
    // Clocks in London go forward at 01:00 UTC on 31 March 2030.
    const start = Date.parse('2030-03-30T12:00:00Z');
    expect(formatClock(start + 12.5 * 3600_000, 'Europe/London')).toBe('00:30');
    expect(formatClock(start + 13.5 * 3600_000, 'Europe/London')).toBe('02:30');
  });
});

describe('formatElapsed', () => {
  it('shows hours and minutes with a sign', () => {
    expect(formatElapsed(0)).toBe('+0:00');
    expect(formatElapsed(12 * 3600 + 42 * 60 + 59)).toBe('+12:42');
    expect(formatElapsed(24 * 3600)).toBe('+24:00');
    expect(formatElapsed(-600)).toBe('-0:10');
  });
});

describe('formatRaceTime', () => {
  const elapsed = 13 * 3600 + 42 * 60;

  it('shows the local time and the race elapsed time', () => {
    expect(formatRaceTime(START, elapsed, { timeZone: 'UTC' })).toBe(
      '01:42 (+13:42)'
    );
  });

  it('can leave the elapsed time out', () => {
    expect(
      formatRaceTime(START, elapsed, { timeZone: 'UTC', showElapsed: false })
    ).toBe('01:42');
  });

  it('falls back to the elapsed time without a race start', () => {
    expect(formatRaceTime(null, elapsed)).toBe('+13:42');
  });
});

describe('formatCountdown', () => {
  it('rounds up to whole minutes', () => {
    expect(formatCountdown(2 * 3600 + 10 * 60)).toBe('2h 10m');
    expect(formatCountdown(2 * 3600 + 5 * 60)).toBe('2h 05m');
    expect(formatCountdown(45 * 60)).toBe('45m');
    expect(formatCountdown(30)).toBe('1m');
  });

  it('says now once the time has passed', () => {
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(-5)).toBe('now');
  });
});

describe('driverName', () => {
  it('finds the driver in the planning', () => {
    expect(driverName(planning, 102)).toBe('Driver B');
  });

  it('handles an unassigned stint and an unknown driver', () => {
    expect(driverName(planning, null)).toBe(UNASSIGNED_DRIVER);
    expect(driverName(planning, 999)).toBe(UNKNOWN_DRIVER);
    expect(driverName(null, 101)).toBe(UNKNOWN_DRIVER);
  });
});

describe('selectStrategy', () => {
  const state = { planning, strategyId: 2 } as RacePlanState;

  it('prefers the snapshot strategy, then the configured one', () => {
    expect(selectStrategy(state, 1)?.id).toBe(1);
    expect(selectStrategy(state)?.id).toBe(2);
  });

  it('falls back to the first strategy, or null without a planning', () => {
    expect(selectStrategy(state, 99)?.id).toBe(1);
    expect(selectStrategy(null)).toBeNull();
  });
});

describe('current and next stint', () => {
  const stints = [
    stint(1, 101, 'done'),
    stint(2, 102, 'current'),
    stint(3, 101, 'upcoming'),
    stint(4, null, 'unassigned'),
    stint(5, 102, 'dropped'),
  ];

  it('finds the current and next stint', () => {
    const snapshot = { stints, currentStintIndex: 1 };
    expect(currentStint(snapshot)?.number).toBe(2);
    expect(nextStint(snapshot)?.number).toBe(3);
  });

  it('has the first stint next before green', () => {
    const snapshot = { stints, currentStintIndex: null };
    expect(currentStint(snapshot)).toBeNull();
    expect(nextStint(snapshot)?.number).toBe(3);
  });

  it('can have an unassigned stint next', () => {
    expect(nextStint({ stints, currentStintIndex: 2 })?.number).toBe(4);
  });

  it('counts stints still in the race', () => {
    expect(plannedStintCount(stints)).toBe(4);
  });
});

describe('findMyNextStint', () => {
  const stints = [
    stint(1, 101, 'done'),
    stint(2, 101, 'current'),
    stint(3, 102, 'upcoming'),
    stint(4, 101, 'upcoming'),
    stint(5, 102, 'dropped'),
  ];

  it('finds the next stint that has not started', () => {
    expect(findMyNextStint(stints, 101)?.number).toBe(4);
  });

  it('is null when none are left or the id is unknown', () => {
    expect(findMyNextStint(stints.slice(0, 3), 101)).toBeNull();
    expect(findMyNextStint(stints, 102)?.number).toBe(3);
    expect(findMyNextStint(stints, null)).toBeNull();
    expect(findMyNextStint(stints, undefined)).toBeNull();
  });

  it('skips a dropped stint', () => {
    expect(findMyNextStint([stint(5, 102, 'dropped')], 102)).toBeNull();
  });
});

describe('myNextStintText', () => {
  const base = {
    raceStartMs: START,
    elapsedSec: 3600,
    currentStintIndex: 1,
  };
  const stints = [
    stint(1, 101, 'done'),
    stint(2, 102, 'current'),
    stint(3, 101, 'upcoming', 3600 + 2 * 3600 + 10 * 60),
  ];

  it('says when the next stint starts', () => {
    expect(myNextStintText({ ...base, stints }, 101, { timeZone: 'UTC' })).toBe(
      'Your next stint in 2h 10m (15:10)'
    );
  });

  it('covers driving now, none left and not in the plan', () => {
    expect(myNextStintText({ ...base, stints }, 102)).toBe(
      'You are driving your last stint'
    );
    expect(myNextStintText({ ...base, stints: stints.slice(0, 2) }, 101)).toBe(
      'No more stints for you'
    );
    expect(myNextStintText({ ...base, stints }, 999)).toBeNull();
    expect(myNextStintText({ ...base, stints }, undefined)).toBeNull();
  });

  it('gives the next stint while driving', () => {
    const more = [...stints, stint(4, 102, 'upcoming', 3600 + 45 * 60)];
    expect(myNextStintText({ ...base, stints: more }, 102)).toBe(
      'You are driving now. Next stint in 45m'
    );
  });
});
