import { describe, it, expect } from 'vitest';
import {
  assignCornerBrakePoints,
  brakeReleasesFor,
  compareCornerBrakePoint,
} from './cornerBrakePointDelta';

const TRACK_LENGTH_M = 5000;
const LOOKBACK_M = 400;

/**
 * Corner ends default to 50 m past their start and brake releases to unknown,
 * which is what every case that predates the continuation rule wants: an
 * unknown release can never read as braking carried into the next corner.
 */
const assign = (
  cornerStartPcts: number[],
  brakePointsM: number[],
  options: { endPcts?: number[]; releasesM?: number[] } = {}
) =>
  assignCornerBrakePoints({
    cornerStartPcts,
    cornerEndPcts: options.endPcts ?? cornerStartPcts.map((p) => p + 0.01),
    brakePointsM: Float32Array.from(brakePointsM),
    brakeReleasesM: Float32Array.from(
      options.releasesM ?? brakePointsM.map(() => Number.NaN)
    ),
    trackLengthM: TRACK_LENGTH_M,
    maxLeadM: LOOKBACK_M,
  });

describe('assignCornerBrakePoints', () => {
  it('gives a corner the brake point just before it', () => {
    // Corner at 1000 m, braking began 50 m earlier.
    expect(assign([0.2], [950])).toEqual([950]);
  });

  it('never gives a corner a point in the gap after it', () => {
    // Okayama's Hobbs Corner ends 73 m before Mike Knight Corner starts, and
    // the braking for Mike Knight lands in that gap. It is the approach to the
    // corner after, not late braking belonging to the one before: here A spans
    // 1000-1050 m, B starts at 1200, and the point at 1150 is B's.
    expect(assign([0.2, 0.24], [1150])).toEqual([null, 1150]);
  });

  it('gives each point to exactly one corner, earliest corner first', () => {
    // Two corners close together with one brake point each.
    expect(assign([0.2, 0.24], [950, 1150])).toEqual([950, 1150]);
  });

  it('assigns the first application in a split corner and the next application to the next section', () => {
    // A starts at 1000 m and B at 1250 m. Both applications happen after A
    // starts; the first belongs to A and the released/reapplied one belongs to
    // B through B's backward search.
    expect(
      assign([0.2, 0.25], [1100, 1200], {
        endPcts: [0.25, 0.28],
        releasesM: [1150, 1300],
      })
    ).toEqual([1100, 1200]);
  });

  it('leaves a corner blank when its braking belongs to the corner before it', () => {
    // One brake point for two corners: the first owns it, the second — driven
    // flat out of the first — gets nothing rather than borrowing it.
    expect(assign([0.2, 0.21], [950])).toEqual([950, null]);
  });

  it('reaches far enough back for a braking zone from top speed', () => {
    // 250 m of braking into a corner at 1000 m. The old 150 m window missed it.
    expect(assign([0.2], [750])).toEqual([750]);
  });

  it('ignores a point further back than the search distance', () => {
    expect(assign([0.2], [500])).toEqual([null]);
  });

  it('attributes a brake point across the start/finish line', () => {
    // Corner just after the line at 50 m, braking began at 4950 m.
    expect(assign([0.01], [4950])).toEqual([4950]);
  });

  it('reports no points at all without a usable track length', () => {
    expect(
      assignCornerBrakePoints({
        cornerStartPcts: [0.2],
        cornerEndPcts: [0.21],
        brakePointsM: Float32Array.from([950]),
        brakeReleasesM: Float32Array.from([Number.NaN]),
        trackLengthM: 0,
        maxLeadM: LOOKBACK_M,
      })
    ).toEqual([null]);
  });

  it('leaves every corner blank for a reference lap with no brake points', () => {
    expect(assign([0.2, 0.5], [])).toEqual([null, null]);
  });
});

describe('assignCornerBrakePoints, braking carried into the next corner', () => {
  // A complex split into abutting halves, as Imola's Acque Minerali is:
  // A spans 1000-1250 m, B 1250-1400 m.
  const SPLIT = { endPcts: [0.25, 0.28] };
  const halves = [0.2, 0.25];

  it('gives the braking to the half it began in, not the half it ended in', () => {
    // One application from 1100 m — inside A — still on when B starts at 1250.
    expect(assign(halves, [1100], { ...SPLIT, releasesM: [1300] })).toEqual([
      1100,
      null,
    ]);
  });

  it('assigns a later re-application to the next section', () => {
    // An approach brake for A at 950, then a second application inside A after
    // release. A keeps the first application; B gets the later one.
    expect(
      assign(halves, [950, 1100], {
        ...SPLIT,
        releasesM: [Number.NaN, 1300],
      })
    ).toEqual([950, 1100]);
  });

  it('assigns a first application inside a section to that section', () => {
    // The Becketts/Chapel case: braking starts inside the fast corner A but is
    // released at 1200, before B starts — so it is an approach brake for B.
    expect(assign(halves, [1100], { ...SPLIT, releasesM: [1200] })).toEqual([
      1100,
      null,
    ]);
  });

  it('assigns braking inside the last section to that section', () => {
    // Nothing follows it, so there is nothing the braking can run into.
    expect(
      assign([0.2], [1100], { endPcts: [0.25], releasesM: [1300] })
    ).toEqual([1100]);
  });

  it('does not require a release for an in-section application', () => {
    expect(
      assign(halves, [1100], { ...SPLIT, releasesM: [Number.NaN] })
    ).toEqual([1100, null]);
  });

  it('leaves braking that starts late in a corner to the corner after it', () => {
    // Okayama's Revolver Corner runs into Piper: the braking for Piper begins
    // inside Revolver, but late in it, so it is Piper's approach rather than
    // Revolver's own. Here A spans 1000-1250 m and B starts at 1400; the point
    // at 1180 is past A's midpoint of 1125. Bounding at A's *end* would not
    // separate these — the point is genuinely inside A.
    expect(assign([0.2, 0.28], [1180], { endPcts: [0.25, 0.32] })).toEqual([
      null,
      1180,
    ]);
  });

  it('carries braking across the start/finish line', () => {
    // A spans 4900-4990 m, B 4990 m-50 m. Braking begins at 4930 — inside A,
    // and in its first half, so it is A's own.
    expect(
      assign([0.98, 0.998], [4930], {
        endPcts: [0.998, 0.01],
        releasesM: [30],
      })
    ).toEqual([4930, null]);
  });
});

describe('brakeReleasesFor', () => {
  const releases = (brakePointsM: number[], brakeOffM: number[]) =>
    Array.from(
      brakeReleasesFor(
        Float32Array.from(brakePointsM),
        Float32Array.from(brakeOffM),
        TRACK_LENGTH_M,
        LOOKBACK_M
      )
    );

  it('pairs each application with the release that closes it', () => {
    expect(releases([950, 2000], [1050, 2100])).toEqual([1050, 2100]);
  });

  it('takes the first release ahead, not the nearest either way', () => {
    expect(releases([1000], [960, 1080])).toEqual([1080]);
  });

  it('reports NaN when the lap never releases within reach', () => {
    expect(releases([1000], [4000])).toEqual([Number.NaN]);
    expect(releases([1000], [])).toEqual([Number.NaN]);
  });

  it('pairs across the start/finish line', () => {
    expect(releases([4950], [60])).toEqual([60]);
  });
});

describe('compareCornerBrakePoint', () => {
  /** The corner the deltas below belong to: 1000-1250 m. */
  const CORNER_START_M = 1000;
  const CORNER_END_M = 1250;

  const compare = (
    referenceBrakeM: number,
    driverBrakeOnM: number[],
    corner: { startM?: number; endM?: number } = {}
  ) =>
    compareCornerBrakePoint({
      referenceBrakeM,
      trackLengthM: TRACK_LENGTH_M,
      driverBrakeOnM: Float32Array.from(driverBrakeOnM),
      driverBrakeOnCount: driverBrakeOnM.length,
      cornerStartM: corner.startM ?? CORNER_START_M,
      cornerEndM: corner.endM ?? CORNER_END_M,
      lookbackM: LOOKBACK_M,
    });

  it('reports a positive delta when the driver brakes later than the reference', () => {
    expect(compare(950, [957])).toBe(7);
  });

  it('reports a negative delta when the driver brakes earlier than the reference', () => {
    expect(compare(950, [943])).toBe(-7);
  });

  it('reports a big difference rather than dropping it', () => {
    // The regression this exists for. A fixed radius around the reference
    // point used to return null here, so the panel showed no number at all —
    // and precisely for the differences most worth reading.
    expect(compare(950, [870])).toBe(-80);
    expect(compare(950, [700])).toBe(-250);
  });

  it('ignores braking further back than the corner is looked for', () => {
    // 400 m before the corner's start is the reach; 550 m out belongs to
    // whatever came before it.
    expect(compare(950, [450])).toBeNull();
    expect(compare(950, [601])).toBe(-349);
  });

  it('ignores braking past the corner exit', () => {
    // Inside the corner still counts — braking can begin after turn-in — but
    // past the exit it is the next corner's.
    expect(compare(950, [1200])).toBe(250);
    expect(compare(950, [1300])).toBeNull();
  });

  it('returns null when the driver has no brake data at all', () => {
    expect(compare(950, [])).toBeNull();
  });

  it('pairs the driver application nearest the reference one', () => {
    expect(compare(950, [905, 955, 1200])).toBe(5);
  });

  it('refuses a corner with no length to it', () => {
    expect(compare(950, [943], { startM: 1000, endM: 1000 })).toBeNull();
  });

  it('pairs across the start/finish line', () => {
    // A corner just after the line at 50-200 m, braking began at 4990 m.
    expect(compare(4990, [10], { startM: 50, endM: 200 })).toBe(20);
    // ...and the window reaches back over the line for the driver too.
    expect(compare(4990, [4900], { startM: 50, endM: 200 })).toBe(-90);
  });
});
