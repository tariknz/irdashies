import { describe, expect, it } from 'vitest';
import {
  createLmuLapDistanceState,
  estimateLmuLapDistPct,
  resetLmuLapDistanceState,
} from './lapDistance';

const TRACK_M = 7000;
/** 70 m/s ~= 252 km/h, so one 200 ms scoring window covers 14 m. */
const SPEED = 70;

const frame = (overrides: {
  scoringPct?: number;
  elapsedTime: number;
  lapNumber?: number;
  speedMs?: number;
  trackLengthM?: number;
}) => ({
  scoringPct: overrides.scoringPct ?? 0.5,
  elapsedTime: overrides.elapsedTime,
  lapNumber: overrides.lapNumber ?? 3,
  speedMs: overrides.speedMs ?? SPEED,
  trackLengthM: overrides.trackLengthM ?? TRACK_M,
});

describe('estimateLmuLapDistPct', () => {
  it('advances between scoring updates instead of standing still', () => {
    const state = createLmuLapDistanceState();
    // First frame anchors on scoring.
    expect(estimateLmuLapDistPct(state, frame({ elapsedTime: 10 }))).toBe(0.5);

    // Scoring has not moved, but 100 ms of travel has: 7 m of a 7000 m lap.
    const after = estimateLmuLapDistPct(state, frame({ elapsedTime: 10.1 }));
    expect(after).toBeCloseTo(0.5 + 7 / TRACK_M, 9);
    expect(after).toBeGreaterThan(0.5);
  });

  it('gives roughly a metre of resolution where scoring gave fourteen', () => {
    // The point of the whole exercise: LapTrace discards samples that have not
    // advanced, so a static fraction produced ~5 samples/second.
    const state = createLmuLapDistanceState();
    const seen = new Set<number>();
    for (let i = 0; i <= 13; i += 1) {
      seen.add(
        estimateLmuLapDistPct(state, frame({ elapsedTime: 10 + i * 0.015 }))
      );
    }
    // 14 polls across one scoring window, every one a distinct position.
    expect(seen.size).toBe(14);
  });

  it('resynchronises on every scoring update, so error cannot compound', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: 0.5 }));

    // One window integrated with a wildly wrong speed, to overshoot on purpose.
    const overshot = estimateLmuLapDistPct(
      state,
      frame({ elapsedTime: 10.19, speedMs: 200, scoringPct: 0.5 })
    );
    const initialLead = overshot - 0.5;
    expect(initialLead).toBeGreaterThan(0);

    // Scoring now advances correctly. Each update re-anchors, so the lead over
    // scoring shrinks instead of compounding — that is what bounds the error,
    // rather than the integration being accurate.
    let lead = initialLead;
    for (let i = 1; i <= 4; i += 1) {
      const scoringPct = 0.5 + (i * SPEED * 0.2) / TRACK_M;
      const value = estimateLmuLapDistPct(
        state,
        frame({ elapsedTime: 10 + i * 0.2, speedMs: SPEED, scoringPct })
      );
      const nextLead = value - scoringPct;
      expect(nextLead).toBeLessThanOrEqual(lead + 1e-12);
      lead = nextLead;
    }
    expect(lead).toBeLessThan(initialLead);
  });

  it('never steps backwards within a lap', () => {
    // A backward step would reach the sample buffer as a reversal and mark the
    // lap dirty, so the estimate is held monotonic.
    const state = createLmuLapDistanceState();
    let previous = estimateLmuLapDistPct(state, frame({ elapsedTime: 10 }));
    for (const t of [10.05, 10.1, 10.15, 10.2, 10.25]) {
      const next = estimateLmuLapDistPct(state, frame({ elapsedTime: t }));
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it('hard-resyncs across a lap boundary', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(
      state,
      frame({ elapsedTime: 10, scoringPct: 0.99, lapNumber: 3 })
    );
    // New lap: the fraction wraps and must not be held at 0.99 by monotonicity.
    const wrapped = estimateLmuLapDistPct(
      state,
      frame({ elapsedTime: 10.1, scoringPct: 0.01, lapNumber: 4 })
    );
    expect(wrapped).toBeCloseTo(0.01, 9);
  });

  it('hard-resyncs on a large backward jump, even without a lap change', () => {
    // A spin, a tow or a replay scrub. The lap counter may not have moved.
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: 0.5 }));
    const jumped = estimateLmuLapDistPct(
      state,
      frame({ elapsedTime: 10.1, scoringPct: 0.2 })
    );
    expect(jumped).toBeCloseTo(0.2, 9);
  });

  it('falls back to scoring when the clock stalls for too long', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: 0.5 }));
    // A pause or a dropped frame: integrating a stale speed across it would
    // invent position, so the scoring value stands.
    expect(
      estimateLmuLapDistPct(state, frame({ elapsedTime: 12, scoringPct: 0.5 }))
    ).toBe(0.5);
  });

  it('passes an unusable frame straight through', () => {
    const state = createLmuLapDistanceState();
    // No track length, so no fraction can be computed from a distance.
    expect(
      estimateLmuLapDistPct(state, frame({ elapsedTime: 10, trackLengthM: 0 }))
    ).toBe(0.5);
    // Negative scoring value is the "no car here" sentinel and is preserved.
    expect(
      estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: -1 }))
    ).toBe(-1);
  });

  it('clamps to the end of the lap', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: 0.999 }));
    expect(
      estimateLmuLapDistPct(
        state,
        frame({ elapsedTime: 10.4, speedMs: 300, scoringPct: 0.999 })
      )
    ).toBe(1);
  });

  it('forgets its anchor on reset', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(state, frame({ elapsedTime: 10, scoringPct: 0.5 }));
    resetLmuLapDistanceState(state);
    // A fresh anchor, so the lower fraction is taken rather than held back by
    // the previous lap's monotonic floor.
    expect(
      estimateLmuLapDistPct(
        state,
        frame({ elapsedTime: 10.1, scoringPct: 0.1 })
      )
    ).toBeCloseTo(0.1, 9);
  });
});

describe('estimateLmuLapDistPct invariants', () => {
  // A backward step over MAX_BACKWARD_M reaches LapTrace's sample buffer as a
  // reversal, and LapTraceStore then sets isCleanLap = false -- the lap is
  // never promoted to a reference, with no error anywhere. The monotonic hold
  // in estimateLmuLapDistPct is the only thing preventing that, so this is a
  // load-bearing property rather than a nicety.
  it('never decreases across a long randomised run within one lap', () => {
    // Deterministic PRNG: a flake here would be untraceable otherwise.
    let seed = 0x2f6e2b1;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const state = createLmuLapDistanceState();
    let elapsedTime = 100;
    let scoringPct = 0;
    let lastScoringAt = elapsedTime;
    let previous = -Infinity;

    for (let i = 0; i < 5000; i += 1) {
      // Jittered poll, roughly the 8 ms cadence the bridge now runs at.
      elapsedTime += 0.004 + random() * 0.012;
      // Scoring steps at 5 Hz, tracking the distance actually covered.
      if (elapsedTime - lastScoringAt >= 0.2) {
        scoringPct = Math.min(
          1,
          scoringPct + (SPEED * (elapsedTime - lastScoringAt)) / TRACK_M
        );
        lastScoringAt = elapsedTime;
      }
      const value = estimateLmuLapDistPct(
        state,
        frame({
          scoringPct,
          elapsedTime,
          speedMs: 20 + random() * 60,
        })
      );
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  // The loop body in lmuSdkBridge has no per-iteration try/catch: a throw ends
  // telemetry for the life of the process, with the overlays still reporting
  // the sim connected. This function is pure arithmetic, so the exposure is
  // closed by it being total -- which is what this asserts.
  it('never throws, and keeps finite input finite, on adversarial input', () => {
    const hostile = [
      NaN,
      Infinity,
      -Infinity,
      -1,
      0,
      1e12,
      -1e12,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ];
    const state = createLmuLapDistanceState();

    for (const scoringPct of hostile) {
      for (const elapsedTime of hostile) {
        for (const speedMs of hostile) {
          for (const trackLengthM of hostile) {
            const call = () =>
              estimateLmuLapDistPct(state, {
                scoringPct,
                elapsedTime,
                lapNumber: 3,
                speedMs,
                trackLengthM,
              });
            expect(call).not.toThrow();
            // A NaN scoring fraction passes straight through, which is the
            // documented contract -- the worst case is exactly what the raw
            // value did before this module existed, where
            // Math.min(1, Math.max(0, NaN)) was already NaN. Everything else
            // must stay a real number.
            if (Number.isFinite(scoringPct)) {
              expect(Number.isFinite(call())).toBe(true);
            }
          }
        }
      }
    }
  });

  // Saturation at 1.0 repeats a value the sample buffer then drops, so the
  // last metres of a lap record as a single point. It is bounded rather than
  // fixed: it can only begin once integration crosses 1.0, which is at most
  // one 200 ms scoring interval before the line.
  it('saturates for no more than one scoring interval of travel', () => {
    const state = createLmuLapDistanceState();
    // Anchor just inside the final scoring window: 0.998 of 7 km is 14 m out.
    const scoringPct = 0.998;
    let elapsedTime = 50;
    estimateLmuLapDistPct(state, frame({ scoringPct, elapsedTime }));

    let firstSaturatedAt: number | undefined;
    for (let i = 0; i < 25; i += 1) {
      elapsedTime += 0.008;
      const value = estimateLmuLapDistPct(
        state,
        frame({ scoringPct, elapsedTime })
      );
      if (value >= 1 && firstSaturatedAt === undefined) {
        firstSaturatedAt = elapsedTime;
      }
    }

    expect(firstSaturatedAt).toBeDefined();
    // It saturated only after covering the 14 m the anchor left to the line,
    // not immediately.
    expect((firstSaturatedAt ?? 0) - 50).toBeGreaterThan(0.15);
  });

  // lapNumber comes from the 100 Hz telemetry block, not the 5 Hz scoring one,
  // so the boundary resync lands on the next poll rather than up to 200 ms
  // later. That is what bounds the saturated span above.
  it('recovers on the very next frame after the lap counter flips', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(
      state,
      frame({ scoringPct: 0.999, elapsedTime: 50, lapNumber: 3 })
    );
    // Integrate past the line so the estimate is pinned at 1.
    const saturated = estimateLmuLapDistPct(
      state,
      frame({ scoringPct: 0.999, elapsedTime: 50.2, lapNumber: 3 })
    );
    expect(saturated).toBe(1);

    const afterLine = estimateLmuLapDistPct(
      state,
      frame({ scoringPct: 0.002, elapsedTime: 50.208, lapNumber: 4 })
    );
    expect(afterLine).toBe(0.002);
  });
});

describe('a lap that turns over before scoring wraps', () => {
  /**
   * Drives across the line at a steady SPEED: 10 ms frames, a scoring update
   * every 200 ms reading the true position, and the lap counter flipping
   * `gapM` before scoring's line. Returns each frame's position in metres from
   * scoring's line (negative before it) and how often the value wrapped.
   */
  const driveAcross = (gapM: number) => {
    const state = createLmuLapDistanceState();
    const startM = -gapM - 100;
    let scoringPct = 0;
    const metres: number[] = [];
    let wraps = 0;
    let previous: number | undefined;
    for (let i = 0; i <= 400; i += 1) {
      const elapsedTime = 100 + i / 100;
      const trueM = startM + SPEED * (i / 100);
      // Scoring updates on the 200 ms boundaries only.
      if (i % 20 === 0) {
        scoringPct = (((trueM % TRACK_M) + TRACK_M) % TRACK_M) / TRACK_M;
      }
      const value = estimateLmuLapDistPct(
        state,
        frame({
          lapNumber: trueM >= -gapM ? 5 : 4,
          scoringPct,
          elapsedTime,
        })
      );
      if (previous !== undefined && value < previous - 0.5) wraps += 1;
      previous = value;
      metres.push((value > 0.5 ? value - 1 : value) * TRACK_M);
    }
    return { metres, wraps };
  };

  // LMU increments the lap counter before scoring's percentage wraps, so for a
  // while lapNumber says "new lap" while scoringPct still reads ~0.99: about
  // 1.6 m at Laguna Seca and Fuji, and far more at a circuit whose start and
  // finish lines are apart. Anchoring the new lap at 0.99 stepped back to zero
  // when scoring wrapped; snapping to zero at the flip jumped forward by the
  // gap, and once the gap outlasted the wait, fell back and crossed the line a
  // second time, replaying the same metres on the plot.
  it.each([1.6, 35, 60, 150])(
    'moves steadily through a %f m gap, wrapping once where scoring does',
    (gapM) => {
      const { metres, wraps } = driveAcross(gapM);

      expect(wraps).toBe(1);
      // 0.7 m every frame: no jump at the flip, the line or scoring's wrap.
      for (let i = 1; i < metres.length; i += 1) {
        expect(metres[i] - metres[i - 1]).toBeCloseTo(SPEED / 100, 6);
      }
      // The new lap starts where scoring's line is, not where the counter
      // flipped.
      const firstOnNewLap = metres.findIndex((m) => m >= 0);
      expect(metres[firstOnNewLap]).toBeLessThan(SPEED / 100);
    }
  );

  it('takes a tow back on the old lap as the truth while waiting', () => {
    // The counter has flipped, but scoring then jumps a long way back on the
    // old lap: not the run to the line but a tow or a reset.
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 4, scoringPct: 0.99, elapsedTime: 100 })
    );
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 5, scoringPct: 0.99, elapsedTime: 100.01 })
    );

    const towed = estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 5, scoringPct: 0.6, elapsedTime: 100.2 })
    );

    expect(towed).toBeCloseTo(0.6, 9);
  });

  // The case as measured: LMU's counter flips ~1.6 m before scoring's distance
  // reaches the end of the lap. Snapping to zero at the flip moved the car
  // forward by that much in one frame, then held it when scoring wrapped.
  it('carries a small offset across the line without a jump', () => {
    const state = createLmuLapDistanceState();
    // 3.5 m short of the line at t=100, so scoring's line is at t=100.05.
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 4, scoringPct: 0.9995, elapsedTime: 100 })
    );
    const metres: number[] = [];
    let wraps = 0;
    let previous = 0.9995;
    // 10 ms frames. The counter flips at 100.01, 2.8 m short of the line;
    // scoring wraps on its update at 100.2, reading 10.5 m.
    for (let i = 1; i <= 20; i += 1) {
      const elapsedTime = 100 + i / 100;
      const value = estimateLmuLapDistPct(
        state,
        frame({
          lapNumber: 5,
          scoringPct: i < 20 ? 0.9995 : 10.5 / TRACK_M,
          elapsedTime,
        })
      );
      if (value < previous - 0.5) wraps += 1;
      previous = value;
      metres.push((value > 0.5 ? value - 1 : value) * TRACK_M);
    }

    expect(wraps).toBe(1);
    // 0.7 m every frame: no jump at the flip, the line or scoring's wrap.
    for (let i = 1; i < metres.length; i += 1) {
      expect(metres[i] - metres[i - 1]).toBeCloseTo(0.7, 6);
    }
    // The wrap lands where scoring puts the line, not where the counter
    // flipped.
    expect(metres[3]).toBeCloseTo(-0.7, 6);
    expect(metres[4]).toBeCloseTo(0, 6);
    expect(metres[19]).toBeCloseTo(10.5, 6);
  });

  // Also measured: scoring wraps on the very frame the counter flips, but reads
  // exactly 0 -- held at its own line until the car reaches it. Anchoring
  // there was the same jump as snapping to zero, then a hold on the next
  // update when scoring came back behind the estimate.
  it('carries across the line when scoring reads exactly 0 at the flip', () => {
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 4, scoringPct: 0.9995, elapsedTime: 100 })
    );
    const metres: number[] = [];
    let wraps = 0;
    let previous = 0.9995;
    // The counter flips at 100.03 with scoring at 0, 1.4 m short of the
    // estimate's line; scoring's next update, at 100.2, reads 10.5 m.
    for (let i = 1; i <= 20; i += 1) {
      const scoringPct = i < 3 ? 0.9995 : i < 20 ? 0 : 10.5 / TRACK_M;
      const value = estimateLmuLapDistPct(
        state,
        frame({
          lapNumber: i < 3 ? 4 : 5,
          scoringPct,
          elapsedTime: 100 + i / 100,
        })
      );
      if (value < previous - 0.5) wraps += 1;
      previous = value;
      metres.push((value > 0.5 ? value - 1 : value) * TRACK_M);
    }

    expect(wraps).toBe(1);
    for (let i = 1; i < metres.length; i += 1) {
      expect(metres[i] - metres[i - 1]).toBeCloseTo(0.7, 6);
    }
    expect(metres[19]).toBeCloseTo(10.5, 6);
  });

  it('stays with scoring when the lap changes far from the line', () => {
    // Nothing moves and scoring never wraps: the position is where scoring
    // says, on the old lap, for as long as that lasts.
    const state = createLmuLapDistanceState();
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 4, scoringPct: 0.8, elapsedTime: 100 })
    );
    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 5, scoringPct: 0.8, elapsedTime: 100.01, speedMs: 0 })
    );

    const later = estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 5, scoringPct: 0.8, elapsedTime: 100.6, speedMs: 0 })
    );

    expect(later).toBeCloseTo(0.8, 5);
  });

  it('still trusts scoring on the very first frame', () => {
    // No previous lap to have changed from, so scoring is the only truth
    // available -- joining a session mid-lap must not snap to zero.
    const state = createLmuLapDistanceState();

    const first = estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 3, scoringPct: 0.8, elapsedTime: 50 })
    );

    expect(first).toBeCloseTo(0.8, 5);
  });

  it('anchors on scoring when the lap turns over after it wrapped', () => {
    // The ordinary case: scoring has already wrapped, so it is the anchor.
    const state = createLmuLapDistanceState();

    estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 4, scoringPct: 0.9, elapsedTime: 100 })
    );
    const after = estimateLmuLapDistPct(
      state,
      frame({ lapNumber: 5, scoringPct: 0.02, elapsedTime: 100.2 })
    );

    expect(after).toBeCloseTo(0.02, 2);
  });
});
