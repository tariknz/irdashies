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
    });
  }
  return out;
};

const feed = (scanner: IbtBestLapScanner, samples: IbtSample[]) => {
  for (const s of samples) scanner.push(s);
};

describe('IbtBestLapScanner', () => {
  it('returns null when no complete lap is present', () => {
    const scanner = new IbtBestLapScanner();
    // A single partial lap that never reaches the finish line.
    feed(
      scanner,
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, maxPct: 0.5 })
    );
    expect(scanner.finish()).toBeNull();
  });

  it('selects the fastest valid lap regardless of order', () => {
    const scanner = new IbtBestLapScanner();
    feed(scanner, makeLap({ lap: 1, startTime: 0, lapTimeSec: 95 }));
    feed(scanner, makeLap({ lap: 2, startTime: 95, lapTimeSec: 90 })); // fastest
    feed(scanner, makeLap({ lap: 3, startTime: 185, lapTimeSec: 93 }));
    // A trailing partial in-lap that should be ignored.
    feed(
      scanner,
      makeLap({ lap: 4, startTime: 278, lapTimeSec: 40, maxPct: 0.4 })
    );
    const best = scanner.finish();
    expect(best?.lapNumber).toBe(2);
    expect(best?.lapTimeSec).toBeCloseTo(90, 5);
  });

  it('rejects an out/in lap that spends time on pit road', () => {
    const scanner = new IbtBestLapScanner();
    feed(
      scanner,
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 80, onPit: true }) // fastest but pit
    );
    feed(scanner, makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }));
    const best = scanner.finish();
    expect(best?.lapNumber).toBe(2);
  });

  it('rejects a stationary lap that never gets up to speed', () => {
    const scanner = new IbtBestLapScanner();
    feed(
      scanner,
      makeLap({ lap: 1, startTime: 0, lapTimeSec: 80, peakSpeed: 2 })
    );
    feed(scanner, makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }));
    expect(scanner.finish()?.lapNumber).toBe(2);
  });

  it('rejects a lap with non-finite channel data', () => {
    const scanner = new IbtBestLapScanner();
    const bad = makeLap({ lap: 1, startTime: 0, lapTimeSec: 80 });
    bad[50].speed = Number.NaN;
    feed(scanner, bad);
    feed(scanner, makeLap({ lap: 2, startTime: 80, lapTimeSec: 92 }));
    expect(scanner.finish()?.lapNumber).toBe(2);
  });

  it('breaks exact-time ties by keeping the earlier lap', () => {
    const scanner = new IbtBestLapScanner();
    feed(scanner, makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, n: 200 }));
    feed(scanner, makeLap({ lap: 2, startTime: 90, lapTimeSec: 90, n: 200 }));
    expect(scanner.finish()?.lapNumber).toBe(1);
  });

  it('detects a lap boundary from a LapDistPct wrap even without a Lap change', () => {
    const scanner = new IbtBestLapScanner();
    // Same lap number throughout; only the pct wrap separates the two laps.
    feed(scanner, makeLap({ lap: 0, startTime: 0, lapTimeSec: 95 }));
    feed(scanner, makeLap({ lap: 0, startTime: 95, lapTimeSec: 90 }));
    const best = scanner.finish();
    expect(best).not.toBeNull();
    expect(best?.lapTimeSec).toBeCloseTo(90, 5);
  });

  it('captures the winning lap samples as parallel arrays', () => {
    const scanner = new IbtBestLapScanner();
    feed(scanner, makeLap({ lap: 1, startTime: 0, lapTimeSec: 90, n: 150 }));
    const best = scanner.finish();
    expect(best?.sampleCount).toBe(150);
    expect(best?.samples.pct.length).toBe(150);
    expect(best?.samples.throttle.length).toBe(150);
    expect(best?.samples.pct[0]).toBeGreaterThanOrEqual(0);
    expect(best?.samples.pct[0]).toBeLessThan(1);
  });

  it('keeps per-sample time relative to the lap start', () => {
    const scanner = new IbtBestLapScanner();
    feed(scanner, makeLap({ lap: 2, startTime: 95, lapTimeSec: 90, n: 150 }));
    const best = scanner.finish();
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
        });
      }
    }).toThrow(IbtImportError);
  });
});
