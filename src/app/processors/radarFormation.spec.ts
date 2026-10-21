import { describe, expect, it } from 'vitest';
import { SessionState, TrackLocation } from '@irdashies/types';
import rollingTelemetry from '../../../test-data/1752616787255/telemetry.json';
import rollingSession from '../../../test-data/1752616787255/session.json';
import standingTelemetry from '../../../test-data/1731663749009/telemetry.json';
import standingSession from '../../../test-data/1731663749009/session.json';
import pitStartTelemetry from '../../../test-data/1732260478001/telemetry.json';
import pitStartSession from '../../../test-data/1732260478001/session.json';
import {
  computeFormation,
  PaceMode,
  parseGridPositions,
  parseStartingGrid,
  type FormationInput,
} from './radarFormation';
import { parseTrackLength } from './RadarProcessor';

type Capture = Record<string, { value: unknown[] } | undefined>;
interface CaptureSession {
  WeekendInfo: {
    TrackLength: string;
    WeekendOptions: { StandingStart: number; StartingGrid: string };
  };
  DriverInfo: { DriverCarIdx: number; PaceCarIdx: number };
}

const first = <T>(value: T | T[]): T =>
  Array.isArray(value) ? value[0] : value;

/** Builds formation input from a recorded frame, centred on the player. */
const fromCapture = (
  telemetry: unknown,
  session: unknown,
  overrides: Partial<FormationInput> = {}
): FormationInput => {
  const frame = first(telemetry) as Capture;
  const info = first(session) as CaptureSession;
  const values = <T>(key: string) => (frame[key]?.value ?? []) as T[];
  const pcts = values<number>('CarIdxLapDistPct');
  const focus = info.DriverInfo.DriverCarIdx;
  const length = parseTrackLength(info.WeekendInfo.TrackLength);
  const dists = pcts.map((pct) => {
    if (pct < 0) return NaN;
    let delta = pct - pcts[focus];
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;
    return delta * length;
  });
  const options = info.WeekendInfo.WeekendOptions;
  return {
    focus,
    dists,
    pcts,
    surfaces: values<number>('CarIdxTrackSurface'),
    onPitRoad: values<boolean>('CarIdxOnPitRoad'),
    excluded: new Set([info.DriverInfo.PaceCarIdx]),
    paceMode: values<number>('PaceMode')[0],
    paceLines: values<number>('CarIdxPaceLine'),
    paceRows: values<number>('CarIdxPaceRow'),
    sessionState: values<number>('SessionState')[0],
    speeds: [],
    lapsCompleted: values<number>('CarIdxLapCompleted'),
    paceCarIdx: info.DriverInfo.PaceCarIdx,
    grid: {
      standingStart: options.StandingStart === 1,
      ...parseStartingGrid(options.StartingGrid),
    },
    ...overrides,
  };
};

describe('parseStartingGrid', () => {
  it('reads the width from the sim description', () => {
    expect(parseStartingGrid('2x2 inline pole on left')).toEqual({
      columns: 2,
    });
    expect(parseStartingGrid('3x3 staggered')).toEqual({ columns: 3 });
    expect(parseStartingGrid('single file')).toEqual({ columns: 1 });
  });

  it('falls back to two wide', () => {
    expect(parseStartingGrid(undefined)).toEqual({ columns: 2 });
  });
});

describe('parseGridPositions', () => {
  const entry = (CarIdx: number, Position: number) => ({ CarIdx, Position });

  it("takes this session's own grid, else the qualifying order", () => {
    const session = {
      SessionInfo: {
        Sessions: [
          { SessionNum: 1, QualifyPositions: [entry(7, 0), entry(3, 1)] },
          { SessionNum: 2, QualifyPositions: [entry(3, 0), entry(7, 1)] },
          { SessionNum: 3, QualifyPositions: null },
        ],
      },
      QualifyResultsInfo: { Results: [entry(5, 0), entry(3, 1)] },
    } as never;
    expect([...parseGridPositions(session, 1)]).toEqual([
      [7, 0],
      [3, 1],
    ]);
    expect([...parseGridPositions(session, 2)]).toEqual([
      [3, 0],
      [7, 1],
    ]);
    expect([...parseGridPositions(session, 3)]).toEqual([
      [5, 0],
      [3, 1],
    ]);
  });

  it('counts pole as 0 when the sim numbers from 1', () => {
    const session = {
      QualifyResultsInfo: { Results: [entry(4, 1), entry(9, 2)] },
    } as never;
    expect([...parseGridPositions(session, 0)]).toEqual([
      [4, 0],
      [9, 1],
    ]);
  });
});

describe('computeFormation: rolling start (recorded parade lap)', () => {
  const input = fromCapture(rollingTelemetry, rollingSession);
  const formation = computeFormation(input);

  it('reads lines from the pace data', () => {
    expect(formation?.kind).toBe('pace');
    const myLine = input.paceLines[input.focus];
    for (const [carIdx, slot] of formation?.slots ?? []) {
      expect(slot).toBe(input.paceLines[carIdx] - myLine);
    }
  });

  it('points at the car in our line one row ahead', () => {
    const { focus, paceLines, paceRows } = input;
    const follow = formation?.followCarIdx ?? -1;
    expect(follow).toBeGreaterThanOrEqual(0);
    expect(paceLines[follow]).toBe(paceLines[focus]);
    expect(paceRows[follow]).toBe(paceRows[focus] - 1);
  });

  it('follows the pace car from the front row', () => {
    const poleSitter = input.paceRows.findIndex(
      (row, carIdx) => row === 0 && input.paceLines[carIdx] === 0
    );
    const fromFront = computeFormation(
      fromCapture(rollingTelemetry, rollingSession, { focus: poleSitter })
    );
    expect(fromFront?.followCarIdx).toBe(input.paceCarIdx);
  });

  it('puts everyone in our lane when pacing single file', () => {
    const single = computeFormation({
      ...input,
      paceMode: PaceMode.SingleFileRestart,
    });
    expect([...(single?.slots.values() ?? [])].every((s) => s === 0)).toBe(
      true
    );
  });

  it('ignores a pace mode with no lines assigned', () => {
    expect(
      computeFormation({
        ...input,
        paceLines: input.paceLines.map(() => -1),
        sessionState: SessionState.Racing,
      })
    ).toBeNull();
  });
});

describe('computeFormation: standing start (recorded grid)', () => {
  it('alternates columns down the grid in the order cars sit', () => {
    const input = fromCapture(standingTelemetry, standingSession);
    const formation = computeFormation(input);

    expect(formation?.kind).toBe('grid');
    // Player 4 is second on the grid, so in the right-hand column; pole
    // sitter 6 is one column left, car 10 in third is too, 7 shares ours.
    expect(input.focus).toBe(4);
    expect(formation?.slots.get(6)).toBe(-1);
    expect(formation?.slots.get(10)).toBe(-1);
    expect(formation?.slots.get(7)).toBe(0);
    expect(formation?.followCarIdx).toBeNull();
  });

  it('counts grid boxes, not cars, past an empty box', () => {
    const input = fromCapture(pitStartTelemetry, pitStartSession);
    const formation = computeFormation(input);

    // Car 0 is on pit road; player 8 sits third, so in the pole column.
    expect(input.focus).toBe(8);
    expect(formation?.slots.has(0)).toBe(false);
    expect(formation?.slots.get(2)).toBe(0);
    expect(formation?.slots.get(6)).toBe(1);
    // The box 48 m back is empty, so car 12 behind it stays opposite us
    // even though it is the next car after 9, also opposite.
    expect(formation?.slots.get(9)).toBe(1);
    expect(formation?.slots.get(12)).toBe(1);
    expect(formation?.slots.get(14)).toBe(0);
  });

  it('keeps columns while the pole sitter has not loaded in', () => {
    const input = fromCapture(standingTelemetry, standingSession);
    const pcts = [...input.pcts];
    pcts[6] = -1;
    const withoutPole = { ...input, pcts, dists: input.dists.with(6, NaN) };

    // Counted from car 4, now the front-most, every column would swap.
    expect(computeFormation(withoutPole)?.slots.get(7)).toBe(0);
    expect(computeFormation(withoutPole)?.slots.get(10)).toBe(1);

    const formation = computeFormation({
      ...withoutPole,
      gridPositions: parseGridPositions(first(standingSession) as never, -1),
    });
    expect(formation?.slots.get(10)).toBe(-1);
    expect(formation?.slots.get(7)).toBe(0);
  });

  it('agrees with the grid positions on a full grid and past a pit start', () => {
    for (const [telemetry, session] of [
      [standingTelemetry, standingSession],
      [pitStartTelemetry, pitStartSession],
    ]) {
      const input = fromCapture(telemetry, session);
      const anchored = computeFormation({
        ...input,
        gridPositions: parseGridPositions(first(session) as never, -1),
      });
      expect(anchored?.slots).toEqual(computeFormation(input)?.slots);
    }
  });

  it('takes columns from grid positions when box gaps fit no spacing', () => {
    // Bathurst, 25 AI cars loaded: P2 is us, gaps 11.5 to 12.9 m and one
    // off the fit further back, which dropped every column.
    const dists = [0, 12, 23.9, -12, -24.9, -36.4, -47.9, -59.9, -78];
    const positions = [2, 1, 0, 3, 4, 5, 6, 7, 8];
    const input = {
      focus: 0,
      dists,
      pcts: dists.map(() => 0.98),
      surfaces: dists.map(() => TrackLocation.OnTrack),
      onPitRoad: dists.map(() => false),
      excluded: new Set<number>(),
      paceMode: PaceMode.DoubleFileStart,
      paceLines: dists.map(() => -1),
      paceRows: dists.map(() => -1),
      sessionState: SessionState.GetInCar,
      speeds: [],
      lapsCompleted: dists.map(() => -1),
      paceCarIdx: -1,
      grid: { standingStart: true, columns: 1 },
    };
    expect(computeFormation(input)?.slots.size).toBe(0);

    const slots = computeFormation({
      ...input,
      gridPositions: new Map(positions.map((p, carIdx) => [carIdx, p])),
    })?.slots;
    expect([...(slots ?? [])].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
      [5, 1],
      [6, 0],
      [7, 1],
      [8, 0],
    ]);

    // Positions out of order with the cars (classes, penalties): boxes decide.
    const swapped = new Map(positions.map((p, carIdx) => [carIdx, p]));
    swapped.set(3, 5).set(5, 3);
    expect(
      computeFormation({ ...input, gridPositions: swapped })?.slots.size
    ).toBe(0);
  });

  it('leaves columns to the boxes when a car has no grid position', () => {
    const dists = [0, -12, -24, -36];
    const formation = computeFormation({
      focus: 0,
      dists,
      pcts: dists.map(() => 0.98),
      surfaces: dists.map(() => TrackLocation.OnTrack),
      onPitRoad: dists.map(() => false),
      excluded: new Set<number>(),
      paceMode: PaceMode.NotPacing,
      paceLines: dists.map(() => -1),
      paceRows: dists.map(() => -1),
      sessionState: SessionState.GetInCar,
      speeds: [],
      lapsCompleted: dists.map(() => -1),
      paceCarIdx: -1,
      grid: { standingStart: true, columns: 2 },
      // Car 2 joined late and has no position.
      gridPositions: new Map([
        [0, 0],
        [1, 1],
        [3, 3],
      ]),
    });
    expect(formation?.slots.get(2)).toBe(0);
    expect(formation?.slots.get(3)).toBe(1);
  });

  it('holds while the lights are on, though the sim says Racing', () => {
    const input = fromCapture(standingTelemetry, standingSession, {
      sessionState: SessionState.Racing,
    });
    expect(computeFormation(input)?.kind).toBe('grid');
  });

  it('stops once the field moves or the car has crossed the line', () => {
    const input = fromCapture(standingTelemetry, standingSession);
    const speeds: number[] = [];
    speeds[input.focus] = 10;
    expect(computeFormation({ ...input, speeds })).toBeNull();
    const lapsCompleted = input.lapsCompleted.map(() => 0);
    expect(
      computeFormation({
        ...input,
        lapsCompleted,
        sessionState: SessionState.Racing,
      })
    ).toBeNull();
  });

  it('leaves cars already moving out of the grid', () => {
    const input = fromCapture(standingTelemetry, standingSession);
    const speeds: number[] = [];
    speeds[6] = 20;
    expect(computeFormation({ ...input, speeds })?.slots.has(6)).toBe(false);
  });

  it('runs two columns on a standing grid described as single file', () => {
    // Sebring, Porsche Cup: StartingGrid "single file", boxes 8 m apart.
    const dists = [0, 9, 17, -7.5, -15.2];
    const formation = computeFormation({
      focus: 0,
      dists,
      pcts: dists.map(() => 0.98),
      surfaces: dists.map(() => TrackLocation.OnTrack),
      onPitRoad: dists.map(() => false),
      excluded: new Set(),
      paceMode: PaceMode.DoubleFileStart,
      paceLines: dists.map(() => -1),
      paceRows: dists.map(() => -1),
      sessionState: SessionState.Racing,
      speeds: [],
      lapsCompleted: dists.map(() => -1),
      paceCarIdx: -1,
      grid: { standingStart: true, ...parseStartingGrid('single file') },
    });
    expect(formation?.kind).toBe('grid');
    expect(formation?.slots.get(1)).toBe(1);
    expect(formation?.slots.get(2)).toBe(0);
    expect(formation?.slots.get(3)).toBe(1);
    expect(formation?.slots.get(4)).toBe(0);
  });

  /** Still cars on a two-wide standing grid, car 0 the focus. */
  const gridAt = (dists: number[]) =>
    computeFormation({
      focus: 0,
      dists,
      pcts: dists.map(() => 0.98),
      surfaces: dists.map(() => TrackLocation.OnTrack),
      onPitRoad: dists.map(() => false),
      excluded: new Set(),
      paceMode: PaceMode.NotPacing,
      paceLines: dists.map(() => -1),
      paceRows: dists.map(() => -1),
      sessionState: SessionState.GetInCar,
      speeds: [],
      lapsCompleted: dists.map(() => -1),
      paceCarIdx: -1,
      grid: { standingStart: true, columns: 2 },
    });

  it('keeps columns while the grid fills and most boxes are empty', () => {
    // Boxes 0, 1, 3 and 6 of 8 m: most gaps span empty boxes, which put a
    // median spacing at two boxes and swapped car 2 into our column.
    const formation = gridAt([0, -8.1, -24.2, -47.9]);
    expect(formation?.slots.get(1)).toBe(1);
    expect(formation?.slots.get(2)).toBe(1);
    expect(formation?.slots.get(3)).toBe(0);
  });

  it('draws no columns from gaps that fit no box spacing', () => {
    // 12 m is a box and a half; a car still creeping in sits 1.5 m short.
    for (const dists of [
      [0, -8, -20],
      [0, -8, -9.5, -16],
    ]) {
      const formation = gridAt(dists);
      expect(formation?.kind).toBe('grid');
      expect(formation?.slots.size).toBe(0);
    }
  });

  it('needs the focus car on the grid', () => {
    const input = fromCapture(standingTelemetry, standingSession);
    const surfaces = [...input.surfaces];
    surfaces[input.focus] = TrackLocation.InPitStall;
    expect(computeFormation({ ...input, surfaces })).toBeNull();
  });
});
