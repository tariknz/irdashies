import { describe, expect, it } from 'vitest';
import { IncidentType, type Incident } from '@irdashies/types';
import {
  buildDriverFilterOptions,
  buildIncidentFeedRows,
  buildSessionFilterOptions,
  type IncidentFeedRow,
  type IncidentSessionInfo,
} from './incidentSessions';

const incident = (
  id: string,
  sessionNum: number,
  sessionTime: number,
  overrides: Partial<Incident> = {}
): Incident => ({
  id,
  carIdx: 1,
  driverName: 'Driver',
  carNumber: '1',
  teamName: '',
  sessionNum,
  sessionTime,
  lapNum: 1,
  replayFrameNum: 0,
  type: IncidentType.OffTrack,
  lapDistPct: 0.5,
  timestamp: 0,
  ...overrides,
});

const WEEKEND: IncidentSessionInfo[] = [
  { SessionNum: 0, SessionName: 'PRACTICE', SessionType: 'Practice' },
  { SessionNum: 1, SessionName: 'QUALIFY', SessionType: 'Lone Qualify' },
  { SessionNum: 2, SessionName: 'HEAT 1', SessionType: 'Race' },
  { SessionNum: 3, SessionName: 'FEATURE', SessionType: 'Race' },
];

/** Compact view of the rows: separators as "label:count[*]", incidents as id. */
const describeRows = (rows: IncidentFeedRow[]) =>
  rows.map((row) =>
    row.kind === 'session'
      ? `${row.label}:${row.count}${row.isCurrent ? '*' : ''}`
      : row.incident.id
  );

describe('buildIncidentFeedRows', () => {
  it('puts one separator above a single session, newest incident first', () => {
    const rows = buildIncidentFeedRows(
      [incident('a', 3, 100), incident('b', 3, 300), incident('c', 3, 200)],
      WEEKEND,
      3
    );

    expect(describeRows(rows)).toEqual(['Feature:3*', 'b', 'c', 'a']);
  });

  it('groups many sessions newest session first, whatever the input order', () => {
    const rows = buildIncidentFeedRows(
      [
        // Hydrated archives can arrive with wall-clock order that disagrees
        // with session order.
        incident('p1', 0, 50, { timestamp: 900 }),
        incident('f1', 3, 10, { timestamp: 100 }),
        incident('q1', 1, 70),
        incident('f2', 3, 20),
        incident('h1', 2, 40),
      ],
      WEEKEND,
      3
    );

    expect(describeRows(rows)).toEqual([
      'Feature:2*',
      'f2',
      'f1',
      'Heat 1:1',
      'h1',
      'Qualify:1',
      'q1',
      'Practice:1',
      'p1',
    ]);
  });

  it('restarts row striping in each group', () => {
    const rows = buildIncidentFeedRows(
      [
        incident('f1', 3, 10),
        incident('f2', 3, 20),
        incident('f3', 3, 30),
        incident('q1', 1, 10),
        incident('q2', 1, 20),
      ],
      WEEKEND,
      3
    );

    const stripes = rows.flatMap((row) =>
      row.kind === 'incident' ? [row.isOdd] : []
    );
    expect(stripes).toEqual([false, true, false, false, true]);
  });

  it('falls back to a numbered label when session info is missing', () => {
    const rows = buildIncidentFeedRows([incident('a', 2, 10)], [], null);

    expect(describeRows(rows)).toEqual(['Session 3:1', 'a']);
  });

  it('falls back to the session type when the name is blank', () => {
    const rows = buildIncidentFeedRows(
      [incident('a', 0, 10)],
      [{ SessionNum: 0, SessionName: '', SessionType: 'Offline Testing' }],
      null
    );

    expect(describeRows(rows)).toEqual(['Offline Testing:1', 'a']);
  });

  it('numbers sessions that share a name', () => {
    const rows = buildIncidentFeedRows(
      [incident('a', 0, 10), incident('b', 1, 10), incident('c', 2, 10)],
      [
        { SessionNum: 0, SessionName: 'PRACTICE', SessionType: 'Practice' },
        { SessionNum: 1, SessionName: 'PRACTICE', SessionType: 'Practice' },
        { SessionNum: 2, SessionName: 'RACE', SessionType: 'Race' },
      ],
      2
    );

    expect(describeRows(rows)).toEqual([
      'Race:1*',
      'c',
      'Practice 2:1',
      'b',
      'Practice 1:1',
      'a',
    ]);
  });

  it('shows an empty current session so the session change is visible', () => {
    const rows = buildIncidentFeedRows([incident('q1', 1, 10)], WEEKEND, 3);

    expect(describeRows(rows)).toEqual(['Feature:0*', 'Qualify:1', 'q1']);
  });

  it('shows only the current separator when nothing has happened yet', () => {
    expect(describeRows(buildIncidentFeedRows([], WEEKEND, 0))).toEqual([
      'Practice:0*',
    ]);
  });

  it('hides older sessions whose incidents were all filtered out', () => {
    // The caller already applied the type and driver filters, so sessions 0
    // and 1 simply have nothing left in the list.
    const rows = buildIncidentFeedRows([incident('h1', 2, 10)], WEEKEND, 3);

    expect(describeRows(rows)).toEqual(['Feature:0*', 'Heat 1:1', 'h1']);
  });

  it('adds no current separator when the current session is unknown', () => {
    expect(buildIncidentFeedRows([], WEEKEND, null)).toEqual([]);
  });

  it('does not reorder the input array', () => {
    const input = [incident('a', 0, 10), incident('b', 3, 10)];
    buildIncidentFeedRows(input, WEEKEND, 3);

    expect(input.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('buildSessionFilterOptions', () => {
  it('lists each session with incidents, newest first, with its count', () => {
    const options = buildSessionFilterOptions(
      [
        incident('q1', 1, 10),
        incident('f1', 3, 10),
        incident('q2', 1, 20),
        incident('f2', 3, 20),
        incident('f3', 3, 30),
      ],
      WEEKEND
    );

    expect(options).toEqual([
      { sessionNum: 3, label: 'Feature', count: 3 },
      { sessionNum: 1, label: 'Qualify', count: 2 },
    ]);
  });

  it('labels sessions missing from session info by number', () => {
    expect(buildSessionFilterOptions([incident('a', 0, 10)], [])).toEqual([
      { sessionNum: 0, label: 'Session 1', count: 1 },
    ]);
  });

  it('returns nothing when there are no incidents', () => {
    expect(buildSessionFilterOptions([], WEEKEND)).toEqual([]);
  });

  it('keeps the selected session listed after its incidents are cleared', () => {
    expect(
      buildSessionFilterOptions([incident('f1', 3, 10)], WEEKEND, 1)
    ).toEqual([
      { sessionNum: 3, label: 'Feature', count: 1 },
      { sessionNum: 1, label: 'Qualify', count: 0 },
    ]);
  });
});

describe('buildDriverFilterOptions', () => {
  const incidents = [
    incident('a', 3, 10, { carIdx: 4, driverName: 'Vogel' }),
    incident('b', 1, 10, { carIdx: 2, driverName: 'Anders' }),
    incident('c', 1, 20, { carIdx: 4, driverName: 'Vogel' }),
  ];

  it('lists every driver by name when no session is selected', () => {
    expect(buildDriverFilterOptions(incidents, null, null)).toEqual([
      { carIdx: 2, driverName: 'Anders' },
      { carIdx: 4, driverName: 'Vogel' },
    ]);
  });

  it('lists only drivers with incidents in the selected session', () => {
    expect(buildDriverFilterOptions(incidents, 3, null)).toEqual([
      { carIdx: 4, driverName: 'Vogel' },
    ]);
  });

  it('keeps the selected driver listed after the session changes', () => {
    expect(buildDriverFilterOptions(incidents, 3, 2)).toEqual([
      { carIdx: 2, driverName: 'Anders' },
      { carIdx: 4, driverName: 'Vogel' },
    ]);
  });
});
