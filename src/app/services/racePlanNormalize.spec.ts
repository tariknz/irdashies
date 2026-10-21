import { describe, expect, it } from 'vitest';
import {
  normalizeRacePlanList,
  normalizeRacePlanning,
  RACE_PLAN_LIMITS,
} from './racePlanNormalize';
import {
  FIXTURE_DRIVER_IDS,
  FIXTURE_PLANNING_ID,
  FIXTURE_RACE_START,
  FIXTURE_STRATEGY_ID,
  rawPlanningFixture,
} from './racePlanFixture';

const normalized = (value: unknown = rawPlanningFixture()) => {
  const planning = normalizeRacePlanning(value);
  if (!planning) throw new Error('Expected a planning');
  return planning;
};

describe('normalizeRacePlanning', () => {
  it('converts a planning response to a RacePlanning', () => {
    const planning = normalizeRacePlanning(rawPlanningFixture());
    expect(planning).not.toBeNull();
    if (!planning) return;
    expect(planning).toMatchObject({
      source: 'iraceplan',
      id: FIXTURE_PLANNING_ID,
      sessionName: 'Test 24',
      car: 'Test Car',
      teamId: 5001,
      trackId: 166,
      trackName: 'Test Circuit',
    });
    expect(planning.drivers.map((d) => d.iracingId)).toEqual(
      FIXTURE_DRIVER_IDS
    );
    const [strategy] = planning.strategies;
    expect(strategy).toMatchObject({
      id: FIXTURE_STRATEGY_ID,
      name: 'Main',
      raceStartMs: Date.parse(FIXTURE_RACE_START),
      fuelCapacity: 36,
      pitStopMs: 50_000,
    });
    expect(strategy.stints).toHaveLength(23);
  });

  it('converts stint times to seconds since race start and prefers pinned laps', () => {
    const [strategy] = normalized().strategies;
    expect(strategy.stints[0]).toEqual({
      number: 1,
      driverId: FIXTURE_DRIVER_IDS[0],
      startSec: 0,
      endSec: 61 * 60,
      laps: 33,
      setup: 'dry',
      fuel: 35.7,
      locked: true,
    });
    expect(strategy.stints[1].startSec).toBe(61 * 60 + 50);
    expect(strategy.stints[1].laps).toBe(34);
  });

  it('keeps a double stint and a stint with no driver', () => {
    const [strategy] = normalized().strategies;
    expect(strategy.stints[1].driverId).toBe(strategy.stints[2].driverId);
    expect(strategy.stints[22].driverId).toBeNull();
  });

  it('treats wet figures of 0 or null as not given', () => {
    const [strategy] = normalized().strategies;
    expect(strategy.drivers[0]).toEqual({
      iracingId: FIXTURE_DRIVER_IDS[0],
      avgLapMsDry: 107_000,
      avgLapMsWet: 121_000,
      fuelPerLapDry: 1.05,
      fuelPerLapWet: null,
    });
    expect(strategy.drivers[1].avgLapMsWet).toBeNull();
  });

  it('reads availability windows as epoch milliseconds', () => {
    const planning = normalized();
    expect(planning.drivers[0].availability).toEqual([
      {
        status: 'available',
        startMs: Date.parse('2030-06-01T11:00:00Z'),
        endMs: Date.parse('2030-06-01T22:00:00Z'),
      },
      {
        status: 'unavailable',
        startMs: Date.parse('2030-06-01T22:00:00Z'),
        endMs: Date.parse('2030-06-02T04:00:00Z'),
      },
    ]);
    expect(planning.drivers[1].availability[1].status).toBe('maybe');
  });

  it('drops availability windows it cannot read', () => {
    const raw = rawPlanningFixture();
    raw.planning.driver_availabilities[0].periods.push(
      {
        id: 99,
        status: 'busy',
        start_time: '2030-06-01T11:00:00Z',
        end_time: '2030-06-01T12:00:00Z',
        notes: null,
      },
      {
        id: 98,
        status: 'maybe',
        start_time: '2030-06-01T12:00:00Z',
        end_time: '2030-06-01T11:00:00Z',
        notes: null,
      }
    );
    expect(normalized(raw).drivers[0].availability).toHaveLength(2);
  });

  it('accepts the planning object without its wrapper', () => {
    expect(normalizeRacePlanning(rawPlanningFixture().planning)?.id).toBe(
      FIXTURE_PLANNING_ID
    );
  });

  it('has no team id for a planning that is not a team plan', () => {
    const raw = rawPlanningFixture();
    raw.planning.type = 'individual';
    expect(normalizeRacePlanning(raw)?.teamId).toBeNull();
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['a missing id', { planning: { session: {}, strategies: [] } }],
    ['no strategies', { planning: { id: 1, session: {}, strategies: [] } }],
  ])('rejects %s', (_label, value) => {
    expect(normalizeRacePlanning(value)).toBeNull();
  });

  it('rejects a strategy with a stint it cannot read', () => {
    const raw = rawPlanningFixture();
    (raw.planning.strategies[0].stints[5] as Record<string, unknown>).start_at =
      'yesterday';
    expect(normalizeRacePlanning(raw)).toBeNull();
  });

  it('caps long text and long lists', () => {
    const raw = rawPlanningFixture();
    raw.planning.session.name = 'x'.repeat(1_000);
    const stint = raw.planning.strategies[0].stints[0];
    raw.planning.strategies[0].stints = Array.from(
      { length: RACE_PLAN_LIMITS.stints + 50 },
      (_, i) => ({ ...stint, number: i + 1 })
    );
    const planning = normalized(raw);
    expect(planning.sessionName).toHaveLength(RACE_PLAN_LIMITS.text);
    expect(planning.strategies[0].stints).toHaveLength(RACE_PLAN_LIMITS.stints);
  });
});

describe('normalizeRacePlanList', () => {
  const entry = {
    id: 42,
    session: { name: 'Test 6', start_at: '2030-06-01T12:00:00Z' },
    car: 'Test Car',
    track: { iracing_id: 1, name: 'Test Circuit' },
    type: 'team',
  };

  it('reads the plannings list', () => {
    expect(
      normalizeRacePlanList({
        plannings: [entry, { ...entry, id: 43, type: 'individual' }],
        meta: { count: 2, total: 2 },
      })
    ).toEqual([
      {
        id: 42,
        name: 'Test 6',
        car: 'Test Car',
        isTeam: true,
        trackName: 'Test Circuit',
        startAt: '2030-06-01T12:00:00Z',
      },
      expect.objectContaining({ id: 43, isTeam: false }),
    ]);
  });

  it('skips entries without a usable id and names the rest', () => {
    expect(
      normalizeRacePlanList({ plannings: [{ id: 'x' }, { id: -1 }, { id: 7 }] })
    ).toEqual([
      {
        id: 7,
        name: 'Planning 7',
        car: null,
        isTeam: false,
        trackName: null,
        startAt: null,
      },
    ]);
  });

  it.each([
    ['a bare array', [entry]],
    ['a single planning', { planning: entry }],
  ])('rejects %s', (_label, value) => {
    expect(normalizeRacePlanList(value)).toBeNull();
  });
});
