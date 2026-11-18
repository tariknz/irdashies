import { describe, expect, it } from 'vitest';
import type { RacePlanProjectedStint, RacePlanning } from '@irdashies/types';
import type { RacePlanStintClash } from './clashes';
import {
  demoRacePlanSnapshot,
  demoRacePlanState,
  demoRepairStop,
} from './demoData';
import {
  buildStrategyTimelineView,
  buildStrip,
  buildTimelineRows,
  snapshotClashes,
} from './timeline';

const START = Date.parse('2030-06-01T12:00:00Z');

const stint = (
  number: number,
  driverId: number | null,
  status: RacePlanProjectedStint['status'],
  extra: Partial<RacePlanProjectedStint> = {}
): RacePlanProjectedStint => ({
  number,
  planNumber: number,
  driverId,
  plannedStartSec: (number - 1) * 3600,
  plannedEndSec: number * 3600,
  startSec: (number - 1) * 3600,
  endSec: number * 3600,
  startLap: (number - 1) * 30,
  laps: 30,
  status,
  setup: 'dry',
  rebuilt: false,
  ...extra,
});

const planning = {
  drivers: [
    { iracingId: 101, name: 'Driver A', availability: [] },
    {
      iracingId: 102,
      name: 'Driver B',
      availability: [
        {
          status: 'unavailable',
          startMs: START + 2.5 * 3600_000,
          endMs: START + 10 * 3600_000,
        },
      ],
    },
  ],
} as unknown as RacePlanning;

const snapshot = {
  status: 'racing' as const,
  raceStartMs: START,
  elapsedSec: 5400,
  stints: [
    stint(1, 101, 'done'),
    stint(2, 102, 'current', { startSec: 3700, endSec: 7300 }),
    stint(3, 102, 'upcoming', {
      startSec: 7300,
      endSec: 10_900,
      rebuilt: true,
    }),
    stint(4, null, 'unassigned', {
      planNumber: null,
      plannedStartSec: null,
      plannedEndSec: null,
      startSec: 10_900,
      endSec: 14_400,
    }),
    stint(5, 101, 'dropped', { startSec: 14_400, endSec: 18_000 }),
  ],
};

describe('buildTimelineRows', () => {
  const clashes = snapshotClashes(snapshot, planning, 'UTC');
  const rows = buildTimelineRows(snapshot, planning, 101, clashes, {
    timeZone: 'UTC',
  });

  it('gives each stint its driver, times and status', () => {
    expect(rows.map((row) => [row.number, row.driverName, row.status])).toEqual(
      [
        [1, 'Driver A', 'done'],
        [2, 'Driver B', 'current'],
        [3, 'Driver B', 'upcoming'],
        [4, 'Unassigned', 'unassigned'],
        [5, 'Driver A', 'dropped'],
      ]
    );
    expect(rows[1].plannedStart).toBe('13:00 (+1:00)');
    expect(rows[1].projectedStart).toBe('13:01 (+1:01)');
    expect(rows[3].plannedStart).toBeNull();
  });

  it('marks my stints, rebuilt stints and clashes', () => {
    expect(rows.filter((row) => row.mine).map((row) => row.number)).toEqual([
      1, 5,
    ]);
    expect(rows[2].rebuilt).toBe(true);
    expect(rows[2].clashLevel).toBe('clash');
    expect(rows[2].clashText).toBe(
      'Projected 14:01–15:01, unavailable from 14:30'
    );
    expect(rows[0].clashLevel).toBeNull();
  });

  it('shows planned times on the plan clock when given', () => {
    const [first] = buildTimelineRows(snapshot, planning, 101, [], {
      timeZone: 'UTC',
      showElapsed: false,
      planRaceStartMs: START - 600_000,
    });
    expect(first.plannedStart).toBe('11:50');
    expect(first.projectedStart).toBe('12:00');
  });
});

describe('buildStrip', () => {
  it('spans the race without dropped stints and places now', () => {
    const clashes: RacePlanStintClash[] = [
      { stintNumber: 3, level: 'warning', description: '' },
    ];
    const strip = buildStrip(snapshot, 102, clashes);
    expect(strip.spanSec).toBe(14_400);
    expect(strip.nowPct).toBe(37.5);
    expect(strip.segments.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(strip.segments[0]).toMatchObject({ leftPct: 0, widthPct: 25 });
    expect(strip.segments[2]).toMatchObject({
      mine: true,
      clashLevel: 'warning',
    });
  });

  it('has no now marker before green', () => {
    const strip = buildStrip(
      { ...snapshot, status: 'waiting', elapsedSec: -300 },
      101,
      []
    );
    expect(strip.nowPct).toBeNull();
  });
});

describe('buildStrategyTimelineView', () => {
  const demo = demoRacePlanSnapshot({
    driftSec: 900,
    stops: [demoRepairStop, { ...demoRepairStop, lap: 80, unplanned: false }],
  });

  it('puts the header, rows, strip and stops together', () => {
    const view = buildStrategyTimelineView(demo, demoRacePlanState, 102, {
      timeZone: 'UTC',
    });
    expect(view.header).toMatch(/^Your next stint in \S+ \S+ \(\d\d:\d\d\)$/);
    expect(view.driftText).toBe('+15:00 behind plan');
    expect(view.rows).toHaveLength(23);
    expect(view.rows.filter((row) => row.clashLevel)).toHaveLength(2);
    expect(view.strip.segments).toHaveLength(23);
    expect(view.stripStart).toBe('12:00 (+0:00)');
    expect(view.stops).toEqual([
      {
        key: '60-6400',
        text: 'Stop lap 60: no fuel, no driver change',
        duration: '1:35',
      },
    ]);
  });

  it('can leave finished stints out', () => {
    const view = buildStrategyTimelineView(demo, demoRacePlanState, 102, {
      showDoneStints: false,
    });
    expect(view.rows.map((row) => row.number)[0]).toBe(4);
  });
});
