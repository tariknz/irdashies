/**
 * Streaming fastest-valid-lap scanner.
 *
 * Fed one decoded sample at a time, it accumulates the current candidate lap,
 * finalizes it at each lap boundary, applies validity rules, and keeps only the
 * fastest valid lap seen so far. At most two laps' samples are ever resident —
 * the current candidate and the best — so an endurance file of any length costs
 * the same as a single lap (the plan's memory-bounding requirement).
 *
 * The scanner is pure logic over samples: ibtImport.ts streams the file and
 * feeds it, keeping this unit-testable against synthetic sample sequences.
 */
import type { IbtLapSamples } from '@irdashies/types';
import { IbtImportError } from './ibtErrors';

export type { IbtLapSamples };

export interface IbtSample {
  /** iRacing Lap counter — the canonical lap-boundary signal. */
  lap: number;
  /** LapDistPct, raw (may sit slightly outside [0,1)). */
  pct: number;
  sessionTime: number;
  /** metres per second. */
  speed: number;
  /** 0..1 */
  brake: number;
  /** 0..1 */
  throttle: number;
  /** raw iRacing gear. */
  gear: number;
  /** 0 | 1 */
  absActive: number;
  /** 0 | 1 — used to reject out/in laps. */
  onPitRoad: number;
}

export interface IbtBestLap {
  lapNumber: number;
  lapTimeSec: number;
  sampleCount: number;
  samples: IbtLapSamples;
}

// Validity thresholds — exported so the spec pins them.
/** A lap must reach at least this far before the line to count as complete. */
export const LAP_END_PCT = 0.9;
/** ...and start at least this close to the line. */
export const LAP_START_PCT = 0.1;
/** Fewer samples than this is data noise, not a lap. */
export const MIN_LAP_SAMPLES = 100;
/** Shorter than this (seconds) is not a real lap. */
export const MIN_LAP_TIME_SEC = 5;
/** Longer than this (seconds) is a stint, an AFK, or corrupt timing. */
export const MAX_LAP_TIME_SEC = 1200;
/** The car must exceed this peak speed (m/s) — rejects stationary "laps". */
export const MIN_PEAK_SPEED_MS = 5;
/** More than this fraction of samples on pit road means an out/in lap. */
export const MAX_PIT_FRACTION = 0.05;
/** Ties in lap time within this are broken by coverage then lap number. */
export const LAP_TIME_TIE_EPS = 0.001;
/** A single lap larger than this is pathological — fail rather than grow. */
export const MAX_SINGLE_LAP_SAMPLES = 300_000;

const normalisePct = (pct: number): number => ((pct % 1) + 1) % 1;

interface Candidate {
  lapNumber: number;
  pct: number[];
  throttle: number[];
  brake: number[];
  speed: number[];
  gear: number[];
  absActive: number[];
  sessionTime: number[];
  startSessionTime: number;
  lastSessionTime: number;
  minPct: number;
  maxPct: number;
  peakSpeed: number;
  pitSamples: number;
  invalid: boolean;
}

export class IbtBestLapScanner {
  private current: Candidate | null = null;
  private best: IbtBestLap | null = null;
  private prevPct = -1;

  private newCandidate(lapNumber: number): Candidate {
    return {
      lapNumber,
      pct: [],
      throttle: [],
      brake: [],
      speed: [],
      gear: [],
      absActive: [],
      sessionTime: [],
      startSessionTime: Number.NaN,
      lastSessionTime: Number.NaN,
      minPct: Number.POSITIVE_INFINITY,
      maxPct: Number.NEGATIVE_INFINITY,
      peakSpeed: Number.NEGATIVE_INFINITY,
      pitSamples: 0,
      invalid: false,
    };
  }

  /** Feed one decoded sample. */
  push(sample: IbtSample): void {
    const pct = normalisePct(sample.pct);
    const pctWrap = this.prevPct > 0.9 && pct < 0.1;
    this.prevPct = pct;

    const started = this.current !== null && this.current.pct.length > 0;
    const lapChanged =
      this.current !== null && sample.lap !== this.current.lapNumber;

    if (this.current === null) {
      this.current = this.newCandidate(sample.lap);
    } else if (started && (lapChanged || pctWrap)) {
      this.finalize(this.current);
      this.current = this.newCandidate(sample.lap);
    }

    const c = this.current;

    // Non-finite required channels invalidate the lap rather than poisoning the
    // fastest-lap comparison with NaN.
    if (
      !Number.isFinite(sample.pct) ||
      !Number.isFinite(sample.sessionTime) ||
      !Number.isFinite(sample.speed) ||
      !Number.isFinite(sample.brake) ||
      !Number.isFinite(sample.throttle)
    ) {
      c.invalid = true;
    }

    c.pct.push(pct);
    c.throttle.push(sample.throttle);
    c.brake.push(sample.brake);
    c.speed.push(sample.speed);
    c.gear.push(sample.gear);
    c.absActive.push(sample.absActive ? 1 : 0);
    c.sessionTime.push(sample.sessionTime);

    if (Number.isNaN(c.startSessionTime))
      c.startSessionTime = sample.sessionTime;
    c.lastSessionTime = sample.sessionTime;
    if (pct < c.minPct) c.minPct = pct;
    if (pct > c.maxPct) c.maxPct = pct;
    if (sample.speed > c.peakSpeed) c.peakSpeed = sample.speed;
    if (sample.onPitRoad) c.pitSamples++;

    if (c.pct.length > MAX_SINGLE_LAP_SAMPLES) {
      throw new IbtImportError(
        'lap-too-large',
        'A single lap exceeded the maximum supported sample count'
      );
    }
  }

  /** Finalize the trailing candidate. Call once after the last sample. */
  finish(): IbtBestLap | null {
    if (this.current && this.current.pct.length > 0) {
      this.finalize(this.current);
      this.current = null;
    }
    return this.best;
  }

  private finalize(c: Candidate): void {
    if (c.invalid) return;

    const n = c.pct.length;
    if (n < MIN_LAP_SAMPLES) return;
    if (c.minPct > LAP_START_PCT || c.maxPct < LAP_END_PCT) return;
    if (c.peakSpeed < MIN_PEAK_SPEED_MS) return;
    if (c.pitSamples / n > MAX_PIT_FRACTION) return;

    const lapTimeSec = c.lastSessionTime - c.startSessionTime;
    if (
      !Number.isFinite(lapTimeSec) ||
      lapTimeSec < MIN_LAP_TIME_SEC ||
      lapTimeSec > MAX_LAP_TIME_SEC
    ) {
      return;
    }

    if (!this.isBetter(lapTimeSec, n)) return;

    this.best = {
      lapNumber: c.lapNumber,
      lapTimeSec,
      sampleCount: n,
      samples: {
        pct: Float32Array.from(c.pct),
        // Relative to the lap's first sample so the renderer never sees the
        // absolute session clock — only durations are ever used.
        timeSec: Float32Array.from(
          c.sessionTime,
          (t) => t - c.startSessionTime
        ),
        throttle: Float32Array.from(c.throttle),
        brake: Float32Array.from(c.brake),
        speed: Float32Array.from(c.speed),
        gear: Float32Array.from(c.gear),
        absActive: Float32Array.from(c.absActive),
      },
    };
  }

  /** Deterministic ordering: faster wins; on a tie, more coverage, then this
   *  keeps the incumbent (which was seen earlier). */
  private isBetter(lapTimeSec: number, sampleCount: number): boolean {
    if (this.best === null) return true;
    if (lapTimeSec < this.best.lapTimeSec - LAP_TIME_TIE_EPS) return true;
    if (lapTimeSec > this.best.lapTimeSec + LAP_TIME_TIE_EPS) return false;
    return sampleCount > this.best.sampleCount;
  }
}
