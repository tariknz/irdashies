import { describe, expect, it } from 'vitest';
import { classReferenceLap, lapTimes, medianGreenLapTime } from './lapPace';
import type { LapCrossing } from './types';

const crossing = (
  lap: number,
  sessionTime: number,
  overrides: Partial<LapCrossing> = {}
): LapCrossing => ({
  lap,
  sessionTime,
  classPosition: 1,
  inPit: false,
  offTrack: false,
  lapped: false,
  ...overrides,
});

/**
 * Three clean laps of 90, 91, 92 followed by four flagged laps of 200+. The
 * median of everything would be 200; the median of the green laps is 91.
 */
const mixedRun: LapCrossing[] = [
  crossing(1, 0),
  crossing(2, 90),
  crossing(3, 181),
  crossing(4, 273),
  crossing(5, 473, { inPit: true }),
  crossing(6, 674, { inPit: true }),
  crossing(7, 876, { offTrack: true }),
  crossing(8, 1079, { offTrack: true }),
];

describe('lapTimes', () => {
  it('returns the first difference of crossing times', () => {
    const points = lapTimes([
      crossing(1, 100),
      crossing(2, 190),
      crossing(3, 281),
    ]);

    expect(points).toEqual([
      { lap: 2, value: 90 },
      { lap: 3, value: 91 },
    ]);
  });

  it('skips a difference that spans a missing crossing', () => {
    const points = lapTimes([
      crossing(1, 100),
      crossing(2, 190),
      crossing(5, 550),
      crossing(6, 640),
    ]);

    expect(points).toEqual([
      { lap: 2, value: 90 },
      { lap: 6, value: 90 },
    ]);
  });

  it('returns nothing for fewer than two crossings', () => {
    expect(lapTimes([])).toEqual([]);
    expect(lapTimes([crossing(1, 100)])).toEqual([]);
  });
});

describe('medianGreenLapTime', () => {
  it('ignores pit and off-track laps', () => {
    expect(medianGreenLapTime(mixedRun)).toBe(91);
  });

  it('ignores the lap either side of a pit crossing', () => {
    const outLapIsSlow = [
      crossing(1, 0),
      crossing(2, 90),
      crossing(3, 180),
      crossing(4, 270),
      crossing(5, 400, { inPit: true }),
      // Out-lap, slow but not itself flagged.
      crossing(6, 510),
      crossing(7, 600),
    ];

    expect(medianGreenLapTime(outLapIsSlow)).toBe(90);
  });

  it('returns undefined below three green laps', () => {
    expect(medianGreenLapTime([])).toBeUndefined();
    expect(
      medianGreenLapTime([crossing(1, 100), crossing(2, 190)])
    ).toBeUndefined();
    expect(
      medianGreenLapTime([
        crossing(1, 100),
        crossing(2, 190),
        crossing(3, 280),
        crossing(4, 500, { inPit: true }),
      ])
    ).toBeUndefined();
  });

  it('averages the middle pair for an even count', () => {
    const seconds = medianGreenLapTime([
      crossing(1, 0),
      crossing(2, 90),
      crossing(3, 181),
      crossing(4, 274),
      crossing(5, 369),
    ]);

    expect(seconds).toBe(92);
  });
});

/**
 * A slow opening lap carrying the start, then three settled green laps.
 * Excluding the opening lap gives a median of 91; including it would give 91.5.
 */
const startThenSettled: LapCrossing[] = [
  crossing(0, 0),
  crossing(1, 150),
  crossing(2, 240),
  crossing(3, 331),
  crossing(4, 423),
];

describe('classReferenceLap', () => {
  it('uses the median once there are three settled green laps', () => {
    expect(classReferenceLap(startThenSettled)).toEqual({
      seconds: 91,
      source: 'median',
    });
  });

  it('leaves the opening lap out of the median', () => {
    // The start lap ran 150s. If it leaked into the set the median would be
    // 91.5, and a reference that slow drags the whole field downwards.
    const reference = classReferenceLap(startThenSettled);

    expect(reference?.seconds).toBe(91);
    expect(reference?.seconds).not.toBe(91.5);
  });

  it('falls back to the fastest green lap when only the opening lap is settled', () => {
    // mixedRun has exactly three green laps, so dropping the opening one
    // leaves too few to take a median from.
    expect(classReferenceLap(mixedRun)).toEqual({
      seconds: 90,
      source: 'fastest',
    });
  });

  it('falls back to the fastest lap below three green laps', () => {
    const reference = classReferenceLap([
      crossing(1, 0),
      crossing(2, 95),
      crossing(3, 187),
    ]);

    expect(reference).toEqual({ seconds: 92, source: 'fastest' });
  });

  it('falls back to the fastest flagged lap when no lap is green', () => {
    const reference = classReferenceLap([
      crossing(1, 0, { inPit: true }),
      crossing(2, 150, { inPit: true }),
      crossing(3, 290, { offTrack: true }),
    ]);

    expect(reference).toEqual({ seconds: 140, source: 'fastest' });
  });

  it('returns undefined with no completed lap', () => {
    expect(classReferenceLap([])).toBeUndefined();
    expect(classReferenceLap([crossing(1, 100)])).toBeUndefined();
  });
});
