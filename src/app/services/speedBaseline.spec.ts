import { describe, it, expect } from 'vitest';
import {
  baselineSpeed,
  measureDeceleration,
  SPEED_BASELINE_S,
  type PositionSample,
} from './speedBaseline';

const TRACK_LENGTH_M = 4000; // arbitrary but realistic mid-length circuit
const STEP_S = 0.05; // one of the SDK's uneven frame gaps (0.033 / 0.05 / 0.067)

/**
 * A position history for a car whose speed changes linearly with time:
 * v(t) = v0Kmh - rateKmhPerS * t. rate 0 is constant speed, negative is
 * acceleration.
 *
 * Position is the closed-form integral of v(t), not a step simulation, so
 * every sample is exact and tests can use tight tolerances.
 */
const buildLinearSpeedPositions = (
  v0Kmh: number,
  rateKmhPerS: number,
  stepSeconds: number,
  sampleCount: number,
  trackLengthM: number
): PositionSample[] => {
  const positions: PositionSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i * stepSeconds;
    const distanceM = (v0Kmh * t - (rateKmhPerS * t * t) / 2) / 3.6;
    positions.push({ sessionTime: t, lapDistPct: distanceM / trackLengthM });
  }
  return positions;
};

/**
 * Reproduces the SDK's one-tick-lag artefact: stretches the gap before the
 * final sample to `gapSeconds`, but leaves its lapDistPct as it was, i.e.
 * still only reflecting a normal step of travel.
 */
const withStretchedFinalGap = (
  positions: PositionSample[],
  gapSeconds: number
): PositionSample[] => {
  const prev = positions[positions.length - 2];
  const last = positions[positions.length - 1];
  return [
    ...positions.slice(0, -1),
    { sessionTime: prev.sessionTime + gapSeconds, lapDistPct: last.lapDistPct },
  ];
};

describe('baselineSpeed', () => {
  it.each([45, 180, 300])(
    'reports %i km/h for a car holding that speed for the full baseline',
    (kmh) => {
      const positions = buildLinearSpeedPositions(
        kmh,
        0,
        STEP_S,
        21, // 0..1.0s of history
        TRACK_LENGTH_M
      );
      const result = baselineSpeed(
        positions,
        positions.length - 1,
        SPEED_BASELINE_S,
        TRACK_LENGTH_M
      );
      if (!result) throw new Error('expected result to be a reading');
      expect(result.speed).toBeCloseTo(kmh, 6);
    }
  );

  it('returns null when there is less history than the baseline window', () => {
    const positions = buildLinearSpeedPositions(
      150,
      0,
      STEP_S,
      5, // 0..0.2s, well short of the 0.5s baseline
      TRACK_LENGTH_M
    );
    const result = baselineSpeed(
      positions,
      positions.length - 1,
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    expect(result).toBeNull();
  });

  describe('invalid inputs', () => {
    it('returns null for an empty position history', () => {
      const result = baselineSpeed([], 0, SPEED_BASELINE_S, TRACK_LENGTH_M);
      expect(result).toBeNull();
    });

    it('returns null when endIndex is past the end of the history', () => {
      const positions = buildLinearSpeedPositions(
        150,
        0,
        STEP_S,
        21,
        TRACK_LENGTH_M
      );
      const result = baselineSpeed(
        positions,
        positions.length,
        SPEED_BASELINE_S,
        TRACK_LENGTH_M
      );
      expect(result).toBeNull();
    });

    it('returns null when endIndex is negative', () => {
      const positions = buildLinearSpeedPositions(
        150,
        0,
        STEP_S,
        21,
        TRACK_LENGTH_M
      );
      const result = baselineSpeed(
        positions,
        -1,
        SPEED_BASELINE_S,
        TRACK_LENGTH_M
      );
      expect(result).toBeNull();
    });

    it.each([0, -100])(
      'returns null when trackLengthM is %i',
      (trackLengthM) => {
        const positions = buildLinearSpeedPositions(
          150,
          0,
          STEP_S,
          21,
          TRACK_LENGTH_M
        );
        const result = baselineSpeed(
          positions,
          positions.length - 1,
          SPEED_BASELINE_S,
          trackLengthM
        );
        expect(result).toBeNull();
      }
    );
  });

  it('starts from the newest sample at least baselineSeconds old, not the oldest', () => {
    const positions = buildLinearSpeedPositions(
      150,
      0,
      STEP_S,
      40, // 0..1.95s of history
      TRACK_LENGTH_M
    );
    const result = baselineSpeed(
      positions,
      positions.length - 1, // endIndex 39, sessionTime 1.95
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    if (!result) throw new Error('expected result to be a reading');
    // The tightest sample >=0.5s before 1.95s is index 29 (sessionTime
    // 1.45), not index 0, the oldest sample in the array.
    expect(result.startIndex).toBe(29);
    expect(result.midSessionTime).toBeCloseTo(1.7, 6);
  });

  it('reports a sane positive speed for a car crossing the start/finish line', () => {
    const positions: PositionSample[] = [
      { sessionTime: 0, lapDistPct: 0.99 },
      { sessionTime: 0.5, lapDistPct: 0.0 },
    ];
    const result = baselineSpeed(
      positions,
      1,
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    if (!result) throw new Error('expected result to be a reading');
    // 0.01 of the lap (the wrap-corrected distance) covered in 0.5s.
    expect(result.speed).toBeCloseTo(288, 6);
    expect(result.speed).toBeGreaterThan(0);
  });

  it('treats a small backwards nudge as zero speed, never negative', () => {
    const positions: PositionSample[] = [
      { sessionTime: 0, lapDistPct: 0.5 },
      { sessionTime: 0.5, lapDistPct: 0.499 }, // jitter, not a lap wrap
    ];
    const result = baselineSpeed(
      positions,
      1,
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    if (!result) throw new Error('expected result to be a reading');
    expect(result.speed).toBe(0);
  });

  it('reports exactly 0, not null, for a car stationary across a full baseline', () => {
    // Zero travel over a full baseline is a real 0 km/h reading, not "no
    // data". Telling a parked car from a stalled feed is the caller's job -
    // only the caller knows how long the position has been unchanged.
    const positions: PositionSample[] = Array.from({ length: 20 }, (_, i) => ({
      sessionTime: i * STEP_S,
      lapDistPct: 0.42,
    }));
    const result = baselineSpeed(
      positions,
      positions.length - 1,
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    if (!result) throw new Error('expected result to be a reading');
    expect(result.speed).toBe(0);
  });

  it('reports the midpoint of the span actually used as midSessionTime', () => {
    const positions: PositionSample[] = [
      { sessionTime: 0, lapDistPct: 0.1 },
      { sessionTime: 0.5, lapDistPct: 0.11 },
    ];
    const result = baselineSpeed(
      positions,
      1,
      SPEED_BASELINE_S,
      TRACK_LENGTH_M
    );
    if (!result) throw new Error('expected result to be a reading');
    expect(result.midSessionTime).toBe(0.25);
  });
});

describe('measureDeceleration', () => {
  it('reports ~0 for a car holding a constant speed', () => {
    const positions = buildLinearSpeedPositions(
      200,
      0,
      STEP_S,
      31, // 0..1.5s, two full baselines of history
      TRACK_LENGTH_M
    );
    const result = measureDeceleration(positions, TRACK_LENGTH_M);
    if (!result) throw new Error('expected result to be a reading');
    expect(Math.abs(result.rate)).toBeLessThan(1e-6);
  });

  it.each([43, 90])(
    'reports a known constant deceleration rate of %i km/h/s',
    (rate) => {
      // 43 km/h/s: measured Clio Cup threshold braking (~1.2g).
      // 90 km/h/s: high-downforce car braking at ~2.5g.
      const positions = buildLinearSpeedPositions(
        200,
        rate,
        STEP_S,
        31, // 0..1.5s; speed stays positive throughout for both rates
        TRACK_LENGTH_M
      );
      const result = measureDeceleration(positions, TRACK_LENGTH_M);
      if (!result) throw new Error('expected result to be a reading');
      // The fixture is an exact closed-form integral of a linear speed
      // profile, so differencing two baseline speeds recovers the true
      // rate exactly - this tolerance only allows for float rounding.
      expect(result.rate).toBeCloseTo(rate, 4);
    }
  );

  it('reports a large positive rate for a hard stop', () => {
    const stopTimeS = 1.5;
    const moving = buildLinearSpeedPositions(
      200,
      0,
      STEP_S,
      31, // 0..1.5s at a steady 200 km/h
      TRACK_LENGTH_M
    );
    const stoppedPct = moving[moving.length - 1].lapDistPct;
    const stopped: PositionSample[] = Array.from({ length: 10 }, (_, i) => ({
      sessionTime: stopTimeS + (i + 1) * STEP_S, // 1.55s..2.0s, frozen
      lapDistPct: stoppedPct,
    }));

    const result = measureDeceleration([...moving, ...stopped], TRACK_LENGTH_M);

    if (!result) throw new Error('expected result to be a reading');
    expect(result.fromSpeed).toBeCloseTo(200, 6);
    expect(result.toSpeed).toBeCloseTo(0, 6);
    // Comfortably past any real braking rate and the 150 km/h/s impact
    // threshold it feeds.
    expect(result.rate).toBeGreaterThan(300);
  });

  it('reports a negative rate for a car that is accelerating', () => {
    const positions = buildLinearSpeedPositions(
      100,
      -50, // negative rate = speeding up at 50 km/h/s
      STEP_S,
      31,
      TRACK_LENGTH_M
    );
    const result = measureDeceleration(positions, TRACK_LENGTH_M);
    if (!result) throw new Error('expected result to be a reading');
    expect(result.rate).toBeLessThan(0);
    expect(result.rate).toBeCloseTo(-50, 4);
  });

  it('returns null until there is history for both baselines (~2x baselineSeconds)', () => {
    const tooShort = buildLinearSpeedPositions(
      150,
      0,
      STEP_S,
      20, // 0..0.95s - one baseline, but not enough for a second
      TRACK_LENGTH_M
    );
    expect(measureDeceleration(tooShort, TRACK_LENGTH_M)).toBeNull();

    const justEnough = buildLinearSpeedPositions(
      150,
      0,
      STEP_S,
      21, // 0..1.0s - just enough for both baselines
      TRACK_LENGTH_M
    );
    expect(measureDeceleration(justEnough, TRACK_LENGTH_M)).not.toBeNull();
  });

  describe('the one-sim-tick lag artefact', () => {
    // The SDK can deliver a frame with a 0.0667s gap whose position only
    // moved 0.05s worth - a one-tick lag (see the module comment). Frame to
    // frame, this glitch alone produced ~239 km/h/s of noise at 108 km/h
    // and ~417 km/h/s at 250 km/h, both past the 150 km/h/s impact
    // threshold, so ordinary cornering read as a crash. The 0.5s baseline
    // exists to absorb it.
    it.each([
      { kmh: 108, frameToFrameNoise: 239 },
      { kmh: 250, frameToFrameNoise: 417 },
    ])(
      'stays under the impact threshold at $kmh km/h (frame-to-frame noise was ~$frameToFrameNoise km/h/s)',
      ({ kmh }) => {
        const clean = buildLinearSpeedPositions(
          kmh,
          0,
          STEP_S,
          41, // 0..2.0s, two full baselines either side of the glitch
          TRACK_LENGTH_M
        );
        const positions = withStretchedFinalGap(clean, 0.0667);

        const result = measureDeceleration(positions, TRACK_LENGTH_M);

        if (!result) throw new Error('expected result to be a reading');
        expect(Math.abs(result.rate)).toBeLessThan(150);
      }
    );

    it('gets worse as the baseline window shrinks - why SPEED_BASELINE_S is 0.5s', () => {
      const clean = buildLinearSpeedPositions(
        250,
        0,
        STEP_S,
        41,
        TRACK_LENGTH_M
      );
      const positions = withStretchedFinalGap(clean, 0.0667);

      const wide = measureDeceleration(positions, TRACK_LENGTH_M, 0.5);
      const narrow = measureDeceleration(positions, TRACK_LENGTH_M, 0.1);

      if (!wide) throw new Error('expected wide to be a reading');
      if (!narrow) throw new Error('expected narrow to be a reading');
      expect(Math.abs(wide.rate)).toBeLessThan(150);
      // At a 0.1s baseline the glitch is amplified past the impact
      // threshold itself - the exact false trigger 0.5s avoids.
      expect(Math.abs(narrow.rate)).toBeGreaterThan(150);
      expect(Math.abs(narrow.rate)).toBeGreaterThan(Math.abs(wide.rate));
    });
  });
});
