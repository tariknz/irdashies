import type { RadarHazard, RadarHazardKind } from '@irdashies/types';
import { TrackLocation } from '@irdashies/types';

/** Metres ahead hazards are reported to the renderer, past any setting. */
export const RADAR_HAZARD_MAX_M = 1000;
/** Metres behind a hazard is still reported, so the car on the disc keeps its mark. */
const HAZARD_BEHIND_M = 30;

/** Length of one stretch of the speed profile, in metres. */
const PROFILE_BIN_M = 25;
/** Samples a stretch needs before its speed is trusted. */
const PROFILE_MIN_SAMPLES = 50;
/**
 * The profile follows the fast cars: it rises quickly and sinks slowly, so a
 * stopped car or a slow out-lap barely moves it.
 */
const PROFILE_RISE = 0.2;
const PROFILE_SINK = 0.005;

/** Below this, in m/s, a car counts as stopped wherever it is. */
const STOPPED_MS = 5;
/** Without a profile, a car this fast in m/s counts as at racing speed. */
const FAST_FALLBACK_MS = 15;
/** Slower than this share of the field's speed at the spot is slow. */
const SLOW_SHARE = 0.6;
/** Back above this share, the car is racing again. */
const FAST_SHARE = 0.75;
/** Seconds a car must stay slow before it is reported. */
const SLOW_HOLD_S = 1;
/** Seconds after a sudden drop before it is reported, to skip a single bad frame. */
const SUDDEN_HOLD_S = 0.3;
/** Racing speed to slow within this many seconds is a crash or a spin. */
const SUDDEN_WINDOW_S = 2;
/** Seconds off the surface before an excursion counts; a dip over the kerb does not. */
const OFF_HOLD_S = 0.5;
/** Seconds after coming back on during which a car not yet up to speed is rejoining. */
const REJOIN_S = 5;

interface CarHazardState {
  /** Session time the car was last at racing speed, or -1. */
  lastFast: number;
  /** Session time the current slow spell began, or -1. */
  slowSince: number;
  /** The slow spell began straight from racing speed. */
  sudden: boolean;
  /** Session time the current excursion began, or -1. */
  offSince: number;
  /** Session time the car last came back from a counted excursion, or -1. */
  rejoinedAt: number;
}

const freshState = (): CarHazardState => ({
  lastFast: -1,
  slowSince: -1,
  sudden: false,
  offSince: -1,
  rejoinedAt: -1,
});

export interface HazardFrame {
  time: number;
  focus: number;
  playerPct: number;
  pcts: readonly unknown[];
  speeds: readonly number[];
  surfaces: readonly unknown[];
  onPitRoad: readonly unknown[];
  excluded: ReadonlySet<number>;
  /** Speeds are still settling after a restart: judge nobody yet. */
  settling?: boolean;
  /** Report nothing: full-course caution or a formation, when all are slow. */
  quiet: boolean;
}

/** Shortest signed lap fraction from `from` to `to`, in -0.5..0.5. */
const wrapDelta = (to: number, from: number): number => {
  let delta = to - from;
  if (delta > 0.5) delta -= 1;
  else if (delta < -0.5) delta += 1;
  return delta;
};

/**
 * Finds cars ahead that are crashed, crawling, off the track or rejoining.
 *
 * "Slow" depends on where a car is: 80 km/h is fine in a hairpin and a wreck
 * on a straight. The tracker learns how fast the field goes along each
 * stretch of the lap and judges every car against that. Until a stretch has
 * been driven enough, only a near-stopped car counts.
 */
export class RadarHazardTracker {
  private trackLength = 0;
  private profile = new Float64Array(0);
  private samples = new Uint32Array(0);
  private readonly states = new Map<number, CarHazardState>();

  setTrackLength(metres: number): void {
    if (metres === this.trackLength) return;
    this.trackLength = metres;
    const bins = metres > 0 ? Math.ceil(metres / PROFILE_BIN_M) : 0;
    this.profile = new Float64Array(bins);
    this.samples = new Uint32Array(bins);
    this.states.clear();
  }

  /** Forget every car; the speed profile is the track's and stays. */
  reset(): void {
    this.states.clear();
  }

  /** Field speed at lap progress `pct` in m/s, or null while unknown. */
  expectedSpeed(pct: number): number | null {
    const bin = this.binOf(pct);
    if (bin < 0 || this.samples[bin] < PROFILE_MIN_SAMPLES) return null;
    return this.profile[bin];
  }

  update(frame: HazardFrame): RadarHazard[] {
    const hazards: RadarHazard[] = [];
    if (this.trackLength <= 0 || frame.settling) return hazards;
    const { time, pcts } = frame;

    for (let carIdx = 0; carIdx < pcts.length; carIdx += 1) {
      const pct = pcts[carIdx];
      const surface = frame.surfaces[carIdx];
      if (
        typeof pct !== 'number' ||
        pct < 0 ||
        frame.excluded.has(carIdx) ||
        frame.onPitRoad[carIdx] === true ||
        (surface !== TrackLocation.OnTrack &&
          surface !== TrackLocation.OffTrack)
      ) {
        // Towed, in the pits or gone: whatever it was doing is over.
        this.states.delete(carIdx);
        continue;
      }
      const speed = frame.speeds[carIdx] ?? 0;
      const kind = this.judge(carIdx, pct, speed, surface, time);
      if (!kind || carIdx === frame.focus || frame.quiet) continue;
      const dist = wrapDelta(pct, frame.playerPct) * this.trackLength;
      if (dist < -HAZARD_BEHIND_M || dist > RADAR_HAZARD_MAX_M) continue;
      hazards.push({ carIdx, dist, kind, speed });
    }
    hazards.sort((a, b) => a.dist - b.dist);
    return hazards;
  }

  private judge(
    carIdx: number,
    pct: number,
    speed: number,
    surface: unknown,
    time: number
  ): RadarHazardKind | null {
    let state = this.states.get(carIdx);
    if (!state) {
      state = freshState();
      this.states.set(carIdx, state);
    }

    const expected = this.expectedSpeed(pct);
    const fast =
      expected !== null
        ? speed >= expected * FAST_SHARE
        : speed >= FAST_FALLBACK_MS;
    const slow =
      speed < STOPPED_MS ||
      (expected !== null && speed < expected * SLOW_SHARE);
    const off = surface === TrackLocation.OffTrack;

    if (off) {
      if (state.offSince < 0) state.offSince = time;
    } else if (state.offSince >= 0) {
      if (time - state.offSince >= OFF_HOLD_S) state.rejoinedAt = time;
      state.offSince = -1;
    }

    if (fast) {
      state.lastFast = time;
      state.slowSince = -1;
      state.sudden = false;
      state.rejoinedAt = -1;
    } else if (slow && state.slowSince < 0) {
      state.slowSince = time;
      state.sudden =
        state.lastFast >= 0 && time - state.lastFast <= SUDDEN_WINDOW_S;
    }

    // Only cars running normally on the track teach the profile.
    if (!off && state.slowSince < 0 && state.rejoinedAt < 0) {
      this.learn(pct, speed);
    }

    if (off) {
      return time - state.offSince >= OFF_HOLD_S ? 'off' : null;
    }
    if (state.rejoinedAt >= 0) {
      if (time - state.rejoinedAt <= REJOIN_S) return 'rejoin';
      state.rejoinedAt = -1;
    }
    if (state.slowSince < 0) return null;
    const held = time - state.slowSince;
    if (held < (state.sudden ? SUDDEN_HOLD_S : SLOW_HOLD_S)) return null;
    return state.sudden || speed < STOPPED_MS ? 'crash' : 'slow';
  }

  private learn(pct: number, speed: number): void {
    const bin = this.binOf(pct);
    if (bin < 0 || speed <= 0) return;
    const count = this.samples[bin];
    const current = this.profile[bin];
    if (count === 0) {
      this.profile[bin] = speed;
    } else {
      const weight = speed > current ? PROFILE_RISE : PROFILE_SINK;
      this.profile[bin] = current + weight * (speed - current);
    }
    if (count < PROFILE_MIN_SAMPLES) this.samples[bin] = count + 1;
  }

  private binOf(pct: number): number {
    const bins = this.profile.length;
    if (bins === 0 || pct < 0) return -1;
    return Math.min(Math.floor((pct % 1) * bins), bins - 1);
  }
}
