import {
  LAP_TRACE_SCHEMA_VERSION,
  type LapTraceRecord,
} from '@irdashies/types';

/**
 * Generates a believable lap trace without needing a real telemetry recording.
 *
 * The repo's test-data fixtures are single-frame snapshots, not time series, so
 * there is no recorded lap to load. This models the lap instead: constant
 * deceleration into each apex, constant acceleration out, and pedal positions
 * derived from the resulting speed profile — which is enough to exercise the
 * renderer, the seam handling and the gear-label logic with something that
 * looks like driving. Samples are emitted at a fixed spacing along the lap
 * (1 m by default, about what 60 Hz telemetry gives at speed), with lap time
 * integrated from the speed profile so corner timing is exercised too.
 */

/** Deceleration under braking, m/s^2. Roughly a GT3 car on slicks. */
const DECEL = 12;
/** Acceleration out of a corner, m/s^2. */
const ACCEL = 5;
/** Number of forward gears used to derive shift points. */
const GEAR_COUNT = 6;

export interface SyntheticLapOptions {
  trackLengthM?: number;
  /** Distance between generated samples. */
  sampleSpacingM?: number;
  /** Distances along the lap where corners are, in metres. */
  cornerApexesM?: number[];
  /** Minimum speed at each apex, m/s. Cycled if shorter than cornerApexesM. */
  apexSpeedsMs?: number[];
  topSpeedMs?: number;
  /**
   * Lap time written to the record. Independent of the integrated sample
   * times, which describe the profile; the record's own lap time is what the
   * sim would have reported and callers may want a specific value.
   */
  lapTimeSec?: number;
  trackId?: number;
  carPath?: string;
}

/** Wrap-aware signed distance from `apex` to `d`, in (-L/2, L/2]. */
function signedDelta(d: number, apex: number, lapLength: number): number {
  let delta = d - apex;
  if (delta > lapLength / 2) delta -= lapLength;
  if (delta < -lapLength / 2) delta += lapLength;
  return delta;
}

export function makeSyntheticLapTrace(
  options: SyntheticLapOptions = {}
): LapTraceRecord {
  const {
    trackLengthM = 5000,
    sampleSpacingM = 1,
    cornerApexesM = [400, 1100, 1800, 2600, 3200, 3900, 4600],
    apexSpeedsMs = [30, 45, 22, 38, 28, 50, 33],
    topSpeedMs = 75,
    lapTimeSec = 105.432,
    trackId = 1,
    carPath = 'syntheticcar',
  } = options;

  const n = Math.max(2, Math.ceil(trackLengthM / sampleSpacingM));

  const distanceM = new Float32Array(n);
  const timeSec = new Float32Array(n);
  const throttle = new Float32Array(n);
  const brake = new Float32Array(n);
  const speed = new Float32Array(n);
  const gear = new Float32Array(n);
  const absActive = new Float32Array(n);

  const speedAt = (d: number): number => {
    let v = topSpeedMs;
    for (let k = 0; k < cornerApexesM.length; k++) {
      const apexSpeed = apexSpeedsMs[k % apexSpeedsMs.length];
      const delta = signedDelta(d, cornerApexesM[k], trackLengthM);
      const candidate =
        delta <= 0
          ? Math.sqrt(apexSpeed * apexSpeed + 2 * DECEL * -delta)
          : Math.sqrt(apexSpeed * apexSpeed + 2 * ACCEL * delta);
      if (candidate < v) v = candidate;
    }
    return Math.min(v, topSpeedMs);
  };

  let t = 0;
  let prevV = speedAt(0);
  for (let i = 0; i < n; i++) {
    const d = i * sampleSpacingM;
    const v = speedAt(d);
    const vNext = speedAt((d + sampleSpacingM) % trackLengthM);

    // Trapezoid integration of ds / v — the same identity the corner timing
    // relies on, so a synthetic corner's time is exactly its integral.
    if (i > 0) t += sampleSpacingM / ((prevV + v) / 2);
    prevV = v;

    distanceM[i] = d;
    timeSec[i] = t;
    speed[i] = v;

    // dv/dt from dv/ds: rate = (dv/ds) * v
    const rate = ((vNext - v) / sampleSpacingM) * v;
    if (rate < 0) {
      brake[i] = Math.min(1, -rate / DECEL);
      throttle[i] = 0;
      // ABS engages under heavy braking.
      absActive[i] = brake[i] > 0.9 ? 1 : 0;
    } else {
      throttle[i] = Math.min(1, rate / ACCEL);
      brake[i] = 0;
    }

    gear[i] = Math.max(
      1,
      Math.min(GEAR_COUNT, 1 + Math.floor((v / topSpeedMs) * GEAR_COUNT))
    );
  }

  return {
    schemaVersion: LAP_TRACE_SCHEMA_VERSION,
    source: {
      kind: 'best',
      label: 'Personal Best',
      importedAt: 1700000000000,
    },
    trackId,
    trackConfigName: '',
    carPath,
    trackLengthM,
    lapTimeSec,
    samples: {
      length: n,
      distanceM,
      timeSec,
      throttle,
      brake,
      speed,
      gear,
      absActive,
    },
    recordedAt: 1700000000000,
  };
}
