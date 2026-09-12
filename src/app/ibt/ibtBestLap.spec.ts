import { describe, it, expect } from 'vitest';
import { IbtBestLapScanner, type IbtSample } from './ibtBestLap';
import { IbtImportError } from './ibtErrors';

/**
 * Build one lap's worth of samples. Defaults produce a valid, complete,
 * moving, non-pit lap of `n` samples spanning pct 0..~1 over `lapTimeSec`.
 */
const makeLap = (opts: {
  lap: number;
  startTime: number;
  lapTimeSec: number;
  n?: number;
  peakSpeed?: number;
  onPit?: boolean;
  minPct?: number;
  maxPct?: number;
  /** Incident count at the lap's first sample. */
  incidents?: number;
  /** Sample index at which the incident count steps up by one. */
  incidentAt?: number;
}): IbtSample[] => {
  const {
    lap,
    startTime,
    lapTimeSec,
    n = 200,
    peakSpeed = 60,
    onPit = false,
    minPct = 0,
    maxPct = 0.999,
    incidents = 0,
    incidentAt,
  } = opts;
  const out: IbtSample[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    out.push({
      lap,
      pct: minPct + f * (maxPct - minPct),
      sessionTime: startTime + f * lapTimeSec,
      speed: peakSpeed * (0.5 + 0.5 * Math.sin(f * Math.PI)),
      brake: 0,
      throttle: 1,
      gear: 4,
      absActive: 0,
      onPitRoad: onPit ? 1 : 0,
      incidentCount:
        incidentAt !== undefined && i >= incidentAt ? incidents + 1 : incidents,
    });
  }
  return out;
};

const feed = (scanner: IbtBestLapScanner, samples: IbtSample[]) => {
  for (const s of samples) scanner.push(s);
};

/**
 * Feed a whole file: the laps under test bracketed by the out-lap the
 * recording starts part-way through and the in-lap it stops part-way through,
 * which is what every real .ibt looks like. The brackets matter because a lap
 * counts only when a start/finish crossing both opens and closes it — the
 * fragments at either end of a recording are not laps, however quick their
 * elapsed time looks.
 */
const runFile = (laps: IbtSample[][], incidents = 0) => {
  const scanner = new IbtBestLapScanner();
  feed(
    scanner,
    makeLap({
      lap: 0,
      startTime: -60,
      lapTimeSec: 60,
      minPct: 0.5,
      onPit: true,
      incidents,
    })
  );
  for (const lap of laps) feed(scanner, lap);
  feed(
    scanner,
    makeLap({
      lap: 90,
      startTime: 100_000,
      lapTimeSec: 40,
      maxPct: 0.4,
      onPit: true,
      incidents,
    })
  );
  return scanner.finish();
};

describe('IbtBestLapScanner', () => {
  it('rejects a lap whose incident count changes mid-lap', () => {
    const best = runFile([
      // Fastest lap of the file, but the driver picked up an incident.
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 88, incidentAt: 100 }),
      makeLap({ lap: 2, startTime: 88, lapTimeSec: 92, incidents: 1 }),
    ]);

    expect(best?.lapNumber).toBe(2);
    expect(best?.lapTimeSec).toBeCloseTo(92, 1);
  });

  it('keeps a lap whose incident count is non-zero but steady', () => {
    const best = runFile(
      [makeLap({ lap: 4, startTime: 0, lapTimeSec: 90, incidents: 6 })],
      6
    );
    expect(best?.lapNumber).toBe(4);
  });

  it('rejects a lap the recording started or stopped in the middle of', () => {
    const scanner = new IbtBestLapScanner();
    // Covers the whole track and is the quickest thing in the file, but no
    // crossing opened it: the recording simply began here.
    feed(scanner, makeLap({ lap: 1, startTime: 0, lapTimeSec: 70 }));
    feed(scanner, makeLap({ lap: 2, startTime: 70, lapTimeSec: 95 }));
    // ...and none closed the last one either.
    expect(scanner.finish()).toBeNull();

    // The same laps, properly bracketed, are timeable.
    expect(
      runFile([
        makeLap({ lap: 1, startTime: 0, lapTimeSec: 70 }),
        makeLap({ lap: 2, startTime: 70, lapTimeSec: 95 }),
      ])?.lapNumber
    ).toBe(1);
  });

  it('rejects a trailing lap the recording cut off just short of the line', () => {
    const scanner = new IbtBestLapScanner();
    feed(
      scanner,
      makeLap({ lap: 0, startTime: -60, lapTimeSec: 60, minPct: 0.5 })
    );
    feed(scanner, makeLap({ lap: 1, startTime: 0, lapTimeSec: 90 }));
    // The driver stopped recording at 91% of the lap. It clears the coverage
    // check, and 91% of the track in 82 s beats a full 90 s lap on elapsed
    // time alone — so nothing but the missing crossing rules it out.
    feed(
      scanner,
      makeLap({ lap: 2, startTime: 90, lapTimeSec: 82, maxPct: 0.91 })
    );
    const best = scanner.finish();

    expect(best?.lapNumber).toBe(1);
    expect(best?.lapTimeSec).toBeCloseTo(90, 1);
  });

  it('returns null when no complete lap is present', () => {
    // A single partial lap that never reaches the finish line.
    expect(
      runFile([makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, maxPct: 0.5 })])
    ).toBeNull();
  });

  it('selects the fastest valid lap regardless of order', () => {
    const best = runFile([
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 95 }),
      makeLap({ lap: 2, startTime: 95, lapTimeSec: 90 }), // fastest
      makeLap({ lap: 3, startTime: 185, lapTimeSec: 93 }),
      // A trailing partial in-lap that should be ignored.
      makeLap({ lap: 4, startTime: 278, lapTimeSec: 40, maxPct: 0.4 }),
    ]);
    expect(best?.lapNumber).toBe(2);
    expect(best?.lapTimeSec).toBeCloseTo(90, 5);
  });

  it('rejects an out/in lap that spends time on pit road', () => {
    const best = runFile([
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 80, onPit: true }), // fastest but pit
      makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }),
    ]);
    expect(best?.lapNumber).toBe(2);
  });

  it('rejects a stationary lap that never gets up to speed', () => {
    const best = runFile([
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 80, peakSpeed: 2 }),
      makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }),
    ]);
    expect(best?.lapNumber).toBe(2);
  });

  it('rejects a lap with non-finite channel data', () => {
    const bad = makeLap({ lap: 1, startTime: 0, lapTimeSec: 80 });
    bad[50].speed = Number.NaN;
    const best = runFile([
      bad,
      makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }),
    ]);
    expect(best?.lapNumber).toBe(2);
  });

  it('breaks exact-time ties by keeping the earlier lap', () => {
    const best = runFile([
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, n: 200 }),
      makeLap({ lap: 2, startTime: 90, lapTimeSec: 90, n: 200 }),
    ]);
    expect(best?.lapNumber).toBe(1);
  });

  it('detects a lap boundary from a LapDistPct wrap even without a Lap change', () => {
    // Same lap number throughout; only the pct wrap separates the two laps.
    const best = runFile([
      makeLap({ lap: 7, startTime: 0, lapTimeSec: 95 }),
      makeLap({ lap: 7, startTime: 95, lapTimeSec: 90 }),
    ]);
    expect(best).not.toBeNull();
    expect(best?.lapTimeSec).toBeCloseTo(90, 5);
  });

  it('captures the winning lap samples as parallel arrays', () => {
    const best = runFile([
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, n: 150 }),
    ]);
    expect(best?.sampleCount).toBe(150);
    expect(best?.samples.pct.length).toBe(150);
    expect(best?.samples.throttle.length).toBe(150);
    expect(best?.samples.pct[0]).toBeGreaterThanOrEqual(0);
    expect(best?.samples.pct[0]).toBeLessThan(1);
  });

  it('keeps per-sample time relative to the lap start', () => {
    const best = runFile([
      makeLap({ lap: 2, startTime: 95, lapTimeSec: 90, n: 150 }),
    ]);
    const timeSec = best?.samples.timeSec;
    expect(timeSec?.length).toBe(150);
    // Relative, not the absolute session clock the file carries.
    expect(timeSec?.[0]).toBe(0);
    expect(timeSec?.[149]).toBeCloseTo(90, 4);
    // Monotone — what timeAtDistance() interpolates along.
    for (let i = 1; i < 150; i++) {
      expect(timeSec?.[i]).toBeGreaterThanOrEqual(timeSec?.[i - 1] ?? 0);
    }
  });

  it('throws lap-too-large rather than growing without bound', () => {
    const scanner = new IbtBestLapScanner();
    expect(() => {
      // A lap number that never changes and a pct that never wraps forces the
      // candidate to grow; push well past the cap.
      for (let i = 0; i < 300_001; i++) {
        scanner.push({
          lap: 1,
          pct: 0.5,
          sessionTime: i,
          speed: 50,
          brake: 0,
          throttle: 1,
          gear: 4,
          absActive: 0,
          onPitRoad: 0,
          incidentCount: 0,
        });
      }
    }).toThrow(IbtImportError);
  });
});
