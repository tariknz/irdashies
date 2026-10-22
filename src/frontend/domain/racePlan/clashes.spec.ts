import { describe, expect, it } from 'vitest';
import type {
  RacePlanAvailability,
  RacePlanProjectedStint,
  RacePlanning,
} from '@irdashies/types';
import { findClashes, findStintClash, summarizeClashes } from './clashes';

const START = Date.parse('2030-06-01T00:00:00Z');
const at = (hhmm: string) => Date.parse(`2030-06-01T${hhmm}:00Z`);
const sec = (hhmm: string) => (at(hhmm) - START) / 1000;

const stint = (
  number: number,
  from: string,
  to: string,
  extra: Partial<RacePlanProjectedStint> = {}
): RacePlanProjectedStint => ({
  number,
  planNumber: number,
  driverId: 101,
  plannedStartSec: sec(from),
  plannedEndSec: sec(to),
  startSec: sec(from),
  endSec: sec(to),
  startLap: 0,
  laps: 30,
  status: 'upcoming',
  setup: 'dry',
  rebuilt: false,
  ...extra,
});

const window = (
  status: RacePlanAvailability['status'],
  from: string,
  to: string
): RacePlanAvailability => ({ status, startMs: at(from), endMs: at(to) });

describe('findStintClash', () => {
  it('flags an overlap with an unavailable window as a clash', () => {
    const clash = findStintClash(
      stint(4, '07:52', '08:53'),
      [window('unavailable', '07:30', '12:00')],
      START,
      'UTC'
    );
    expect(clash).toEqual({
      stintNumber: 4,
      level: 'clash',
      description: 'Projected 07:52–08:53, unavailable from 07:30',
    });
  });

  it('describes a window that ends during the stint by its end', () => {
    const clash = findStintClash(
      stint(4, '07:52', '08:53'),
      [window('unavailable', '06:00', '08:30')],
      START,
      'UTC'
    );
    expect(clash?.description).toBe(
      'Projected 07:52–08:53, unavailable until 08:30'
    );
  });

  it('flags an overlap with a maybe window as a warning', () => {
    const clash = findStintClash(
      stint(2, '01:00', '02:00'),
      [window('maybe', '01:30', '03:00')],
      START,
      'UTC'
    );
    expect(clash?.level).toBe('warning');
    expect(clash?.description).toBe(
      'Projected 01:00–02:00, maybe unavailable from 01:30'
    );
  });

  it('prefers a clash over a warning', () => {
    const clash = findStintClash(
      stint(2, '01:00', '02:00'),
      [
        window('maybe', '00:30', '01:30'),
        window('unavailable', '01:45', '03:00'),
      ],
      START,
      'UTC'
    );
    expect(clash?.level).toBe('clash');
  });

  it('ignores available windows and windows that only touch the stint', () => {
    const windows = [
      window('available', '00:00', '23:59'),
      window('unavailable', '02:00', '04:00'),
      window('maybe', '00:00', '01:00'),
    ];
    expect(
      findStintClash(stint(2, '01:00', '02:00'), windows, START, 'UTC')
    ).toBeNull();
  });

  it('only checks the current and upcoming stints', () => {
    const windows = [window('unavailable', '00:00', '23:00')];
    for (const status of ['done', 'dropped', 'unassigned'] as const) {
      expect(
        findStintClash(stint(1, '01:00', '02:00', { status }), windows, START)
      ).toBeNull();
    }
    expect(
      findStintClash(
        stint(1, '01:00', '02:00', { status: 'current' }),
        windows,
        START
      )?.level
    ).toBe('clash');
  });

  it('needs a race start', () => {
    expect(
      findStintClash(
        stint(1, '01:00', '02:00'),
        [window('unavailable', '00:00', '23:00')],
        null
      )
    ).toBeNull();
  });
});

describe('findClashes', () => {
  const planning = {
    drivers: [
      {
        iracingId: 101,
        name: 'Driver A',
        availability: [window('unavailable', '07:30', '12:00')],
      },
      {
        iracingId: 102,
        name: 'Driver B',
        availability: [window('maybe', '02:00', '03:00')],
      },
    ],
  } as unknown as RacePlanning;

  const stints = [
    stint(1, '06:00', '07:00'),
    stint(2, '07:00', '08:00'),
    stint(3, '02:30', '03:30', { driverId: 102 }),
    stint(4, '09:00', '10:00', { driverId: null, status: 'unassigned' }),
    stint(5, '09:00', '10:00', { driverId: 103 }),
  ];

  it('returns a result per clashing stint in stint order', () => {
    const clashes = findClashes(stints, planning, START, 'UTC');
    expect(clashes.map((c) => [c.stintNumber, c.level])).toEqual([
      [2, 'clash'],
      [3, 'warning'],
    ]);
  });

  it('is empty without a planning', () => {
    expect(findClashes(stints, null, START)).toEqual([]);
  });

  it('summarises clashes for a tooltip', () => {
    const summary = summarizeClashes(
      findClashes(stints, planning, START, 'UTC')
    );
    expect(summary.clashes).toBe(1);
    expect(summary.warnings).toBe(1);
    expect(summary.text.split('\n')).toEqual([
      'Stint 2: Projected 07:00–08:00, unavailable from 07:30',
      'Stint 3: Projected 02:30–03:30, maybe unavailable until 03:00',
    ]);
  });
});
