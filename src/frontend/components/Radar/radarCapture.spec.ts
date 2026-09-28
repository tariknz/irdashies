import { describe, expect, it } from 'vitest';
import type { RadarSnapshot } from '@irdashies/types';
import tracks from '../../assets/data/tracks.json';
import type { TrackDrawing } from '@irdashies/domain/trackGeometry';
import {
  computeRadarBlips,
  emptyTargetState,
  type RadarBlip,
} from './radarBlips';
import { overlapFromCarLeftRight } from './overlapSides';
import { parseGridLayout } from './gridLayout';
import nordschleife from '../../../../test-data/1783998516193/telemetry.json';
import nordschleifeSession from '../../../../test-data/1783998516193/session.json';
import interlagosLeft from '../../../../test-data/1747384033336/telemetry.json';
import interlagosLeftSession from '../../../../test-data/1747384033336/session.json';
import interlagos from '../../../../test-data/1752616787256/telemetry.json';
import interlagosSession from '../../../../test-data/1752616787256/session.json';
import brands from '../../../../test-data/1731663749009/telemetry.json';
import brandsSession from '../../../../test-data/1731663749009/session.json';
import watkins from '../../../../test-data/1781323503005/telemetry.json';
import watkinsSession from '../../../../test-data/1781323503005/session.json';
import paulRicard from '../../../../test-data/1763227688917/telemetry.json';
import paulRicardSession from '../../../../test-data/1763227688917/session.json';

/**
 * The radar's placement, checked against recordings rather than against its own
 * arithmetic. iRacing publishes no per-car world position, so lap distance is
 * the only geometry there is — but the sim *does* publish its own distance to
 * the car ahead and behind the player (`CarDistAhead`/`CarDistBehind`), and
 * that is an independent oracle for exactly the quantity the radar draws.
 *
 * A capture is one frame, which is what a placement assertion needs: the
 * recorded `CarIdxLapDistPct`, the recorded `CarLeftRight` verdict and the
 * recorded oracle distances all describe the same instant.
 */

const trackDrawings = tracks as unknown as Record<
  number,
  TrackDrawing | undefined
>;

const trackLengthOf = (session: { WeekendInfo: { TrackLength: string } }) => {
  const match = /([\d.]+)\s*(km|mi)?/.exec(session.WeekendInfo.TrackLength);
  if (!match) throw new Error('capture has no parsable track length');
  if (match[2] === 'km') return Number(match[1]) * 1000;
  if (match[2] === 'mi') return Number(match[1]) * 1609.344;
  return Number(match[1]);
};

interface Capture {
  name: string;
  telemetry: Record<string, { value: unknown[] }>;
  session: {
    Type: string;
    WeekendInfo: { TrackID: number; TrackLength: string };
    DriverInfo: { DriverCarIdx: number };
  };
}

const baseFor = (capture: Capture) => {
  const { telemetry, session } = capture;
  const snapshot: RadarSnapshot = {
    carIdxLapDistPct: (telemetry.CarIdxLapDistPct?.value ?? []) as number[],
    carIdxOnPitRoad: (telemetry.CarIdxOnPitRoad?.value ?? []) as boolean[],
    carIdxPaceRow: (telemetry.CarIdxPaceRow?.value ?? []) as number[],
    carIdxPaceLine: (telemetry.CarIdxPaceLine?.value ?? []) as number[],
    focusCarIdx:
      (telemetry.CamCarIdx?.value?.[0] as number | undefined) ?? null,
    carSpeed: 0,
    isOnTrack: true,
    sessionState: 0,
    version: 0,
  };

  return {
    carIdxLapDistPct: snapshot.carIdxLapDistPct,
    carIdxOnPitRoad: snapshot.carIdxOnPitRoad,
    carIdxPaceRow: snapshot.carIdxPaceRow,
    carIdxPaceLine: snapshot.carIdxPaceLine,
    gridLayout: null,
    playerCarIdx: snapshot.focusCarIdx,
    trackDrawing: trackDrawings[session.WeekendInfo.TrackID],
    trackLengthM: trackLengthOf(session),
    radarRange: 15,
    hideInPit: true,
    overlap: overlapFromCarLeftRight(
      (telemetry.CarLeftRight?.value?.[0] as number) ?? 0
    ),
    vehicleWidth: 1.9,
    vehicleLength: 4.5,
    carNumbers: new Map<number, string>(),
    paceCarIdx: null,
    previousTargets: emptyTargetState(snapshot.carIdxLapDistPct.length),
    nextTargets: emptyTargetState(snapshot.carIdxLapDistPct.length),
    followingMapBuffer: new Float64Array(128),
  };
};

const place = (capture: Capture) => {
  const { telemetry, session } = capture;
  const result = computeRadarBlips(baseFor(capture));

  const scalar = (key: string) => telemetry[key]?.value?.[0] as number;
  return {
    blips: result.blips,
    hasGeometry: result.hasGeometry,
    playerOnRoad: result.playerOnRoad,
    simAheadM: scalar('CarDistAhead'),
    simBehindM: scalar('CarDistBehind'),
    playerCarIdx: session.DriverInfo.DriverCarIdx,
  };
};

const nearest = (blips: readonly RadarBlip[], sign: 1 | -1) =>
  blips
    .filter((blip) => Math.sign(blip.alongM) === sign)
    .sort((a, b) => a.gapM - b.gapM)[0];

const CAPTURES: Capture[] = [
  {
    name: 'Interlagos, a lap-up car closing',
    telemetry: interlagosLeft as never,
    session: interlagosLeftSession as never,
  },
  {
    name: 'Interlagos, a car just ahead',
    telemetry: interlagos as never,
    session: interlagosSession as never,
  },
  {
    name: 'Brands Hatch, one each way',
    telemetry: brands as never,
    session: brandsSession as never,
  },
  {
    name: 'Watkins Glen, a car alongside',
    telemetry: watkins as never,
    session: watkinsSession as never,
  },
  {
    name: 'Paul Ricard, a car ahead',
    telemetry: paulRicard as never,
    session: paulRicardSession as never,
  },
];

describe('radar placement over recorded telemetry', () => {
  for (const capture of CAPTURES) {
    it(`puts the nearest cars where the sim does — ${capture.name}`, () => {
      const placed = place(capture);
      expect(placed.hasGeometry).toBe(true);
      expect(placed.playerOnRoad).toBe(true);

      // The sim's own distances describe the nearest car each way. It publishes
      // a sentinel when there is nothing within half a kilometre, so a usable
      // distance inside the range must come back as a blip at that distance —
      // and one behind the player must come back negative, which is the case a
      // missing lap wrap gets wrong by a whole lap.
      const withinRange = (metres: number) =>
        Number.isFinite(metres) && metres >= 0 && metres <= 15;
      if (withinRange(placed.simAheadM))
        expect(nearest(placed.blips, 1)?.alongM).toBeCloseTo(
          placed.simAheadM,
          1
        );
      if (withinRange(placed.simBehindM))
        expect(nearest(placed.blips, -1)?.alongM).toBeCloseTo(
          -placed.simBehindM,
          1
        );

      for (const blip of placed.blips) {
        expect(blip.gapM).toBeCloseTo(Math.abs(blip.alongM), 6);
        expect(Math.abs(blip.alongM)).toBeLessThanOrEqual(15);
      }
    });
  }

  it('marks a level car the sim stayed silent about, on a recorded frame', () => {
    // Watkins Glen, recorded: car 17 is two millimetres from the player's own
    // lap distance with both on track, and CarLeftRight reads Clear — the sim
    // never calls it. A car cannot share that point of the road, so it is
    // beside the player, and only the side is unknown. This is the recorded
    // shape of "cars pass through me".
    const placed = place(CAPTURES[3]);
    const level = placed.blips.filter((blip) => blip.gapM <= 1);
    expect(level).toHaveLength(1);
    const [beside] = level;
    expect(beside.carIdx).toBe(17);
    expect(beside.side).toBeNull();
    expect(beside.rimSignal).toBe('both');
    // The car behind it, ten metres back in its own lane, is not beside us.
    const behind = placed.blips.find((blip) => blip.carIdx === 19);
    expect(behind?.rimSignal).toBeNull();
  });

  it('does not mark cars the sim did call, nor cars in their own lane', () => {
    // Interlagos with CarLeftRight = CarLeft: the sim named the side, so the
    // car is placed, not flagged as unknown.
    const placed = place(CAPTURES[0]);
    expect(placed.blips[0].side).toBe(-1);
    expect(placed.blips[0].rimSignal).toBeNull();
  });

  it('draws a car the sim reports alongside on that side, clear of the player', () => {
    // Interlagos with CarLeftRight = CarLeft: the car sits 4.6 m back on the
    // same centreline, so without the verdict it would be painted through the
    // player's own rectangle.
    const placed = place(CAPTURES[0]);
    expect(placed.blips).toHaveLength(1);
    const [alongside] = placed.blips;
    expect(alongside.side).toBe(-1);
    expect(alongside.drawLateralM).toBeLessThan(0);
    // One car width plus a margin, so the two bodies do not overlap.
    expect(Math.abs(alongside.drawLateralM)).toBeGreaterThan(1.9);
    // The road reports no lateral offset for an abreast car, and it must stay
    // that way: the side offset is a drawing decision, not a measurement.
    expect(alongside.lateralM).toBeCloseTo(0, 6);
  });

  it('draws the recorded two-abreast grid as two columns, not one file', () => {
    // Nürburgring, recorded on the grid: twenty cars parked on a
    // "2x2 inline pole on left" grid. This is the recording the reported bug
    // came from, and it is the only place the whole reconstruction can be
    // checked against something that was not written by the same reasoning.
    //
    // `CarIdxPosition` reads 0 for every car in this frame, so the first
    // attempt at a grid slot had nothing to work from. The lap distance does:
    // the cars of a row report the same value, eight metres apart from the next
    // row. That is all the columns are built from here.
    const capture: Capture = {
      name: 'Nurburgring, parked on the grid',
      telemetry: nordschleife as never,
      session: nordschleifeSession as never,
    };
    const layout = parseGridLayout('2x2 inline pole on left');
    expect(layout).not.toBeNull();

    // The grid is wider than the 15 m the other cases draw, so the whole field
    // is in range and the reconstruction is judged on all of it.
    const base = { ...baseFor(capture), radarRange: 120 };
    const onGrid = computeRadarBlips({ ...base, gridLayout: layout });
    const onCentreline = computeRadarBlips({ ...base, gridLayout: null });

    // `CarIdxPaceRow` and `CarIdxPaceLine` are the sim's own row and lane
    // numbering, and the sim is the oracle here: the placement is judged against
    // the grid iRacing thinks is there, not against its own reasoning.
    const gridFrame = nordschleife as unknown as Record<
      string,
      { value: number[] }
    >;
    const paceRow = gridFrame.CarIdxPaceRow.value;
    const paceLine = gridFrame.CarIdxPaceLine.value;
    const playerCarIdx = gridFrame.CamCarIdx.value[0];
    const playerRow = paceRow[playerCarIdx];

    // Every car the sim put on the grid gets a column, except the player's own
    // row, which is drawn from the CarLeftRight verdict instead. The pace flags
    // are only set for a car actually on the grid, so row -1 is not one of
    // these — car 64 in this frame is parked in the pit lane.
    //
    // The filter is on the blips rather than the pace flags themselves, because
    // the radar draws a car it can locate. Half this grid reports
    // `CarIdxLapDistPct` of -1 — a real grid slot, a car the SDK cannot yet
    // place on the road — and a blip is never made for one of those. The
    // placement is only as complete as the telemetry the radar is given.
    const shouldPlace = (carIdx: number) =>
      paceRow[carIdx] >= 0 && paceRow[carIdx] !== playerRow;
    const placed = onGrid.blips.filter(
      (blip) => shouldPlace(blip.carIdx) && blip.drawLateralM !== 0
    );
    const ranked = onGrid.blips.filter((blip) => shouldPlace(blip.carIdx));
    expect(placed).toHaveLength(ranked.length);
    // The field reaches both columns, rather than drawing as the single file the
    // bug reported.
    const sides = new Set(placed.map((blip) => Math.sign(blip.drawLateralM)));
    expect(sides).toEqual(new Set([-1, 1]));
    // Every placed car sits at the one offset the layout names, rather than at
    // a spread of guesses.
    for (const blip of placed) {
      expect(Math.abs(blip.drawLateralM)).toBeCloseTo(2.5, 6);
    }

    // The decisive check: the drawn column has to agree with the sim about
    // which lane each car is in. `CarIdxPaceLine` 0 and 1 are the two columns,
    // and a grid placed well enough to be worth drawing has to match.
    const wrong = placed.filter(
      (blip) =>
        Math.sign(blip.drawLateralM) !== (paceLine[blip.carIdx] === 0 ? -1 : 1)
    );
    expect(wrong.map((blip) => blip.carIdx)).toEqual([]);

    // Each row is split across the two columns, so no row is stacked on one side.
    // The rows this checks are the ones the radar can draw, so the expected size
    // is counted from the sim rather than written down: a row holding a car the
    // SDK cannot place has only one car to draw, and one line on its own is the
    // whole of that row rather than a stack.
    const linesByRow = new Map<number, number[]>();
    for (const blip of placed) {
      const row = paceRow[blip.carIdx];
      linesByRow.set(row, [
        ...(linesByRow.get(row) ?? []),
        Math.sign(blip.drawLateralM),
      ]);
    }
    const drawableInRow = (row: number) =>
      onGrid.blips.filter(
        (blip) => shouldPlace(blip.carIdx) && paceRow[blip.carIdx] === row
      ).length;
    for (const [row, lines] of linesByRow) {
      expect(lines.length, `row ${row}`).toBe(drawableInRow(row));
      if (lines.length === 2) expect(new Set(lines)).toEqual(new Set([-1, 1]));
    }

    // The measurement is untouched. Drawing the grid must not disturb what the
    // road reported, because the motion interpolator reads `lateralM` and a
    // placed offset fed back as the next frame's target walks a car off the
    // road between the grid and the start.
    const measured = new Map(
      onCentreline.blips.map((blip) => [blip.carIdx, blip.lateralM])
    );
    for (const blip of onGrid.blips) {
      expect(blip.lateralM).toBe(measured.get(blip.carIdx));
    }
  });
});
