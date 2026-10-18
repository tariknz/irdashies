import type { RadarHazard, RadarHazardKind } from '@irdashies/types';
import { TrackLocation } from '@irdashies/types';
import { wrapDelta } from './radarMath';

/** Metres ahead hazards are reported to the renderer, past any setting. */
export const RADAR_HAZARD_MAX_M = 1000;

/** Below this, in m/s, a car counts as stopped wherever it is. */
const STOPPED_MS = 5;
/** Slower than this share of the focus car's speed is slow for it. */
const SLOW_SHARE = 0.6;
/** A car must be closing at least this fast, in m/s, to concern the focus car. */
const CLOSING_MIN_MS = 8;
/** ...and be reached within this many seconds at that closing speed. */
const REACH_MAX_S = 8;
/** A car racing this fast, in m/s, can have crashed by slowing. */
const RACING_MS = 15;
/** Dropping below this share of its own recent top speed is sudden. */
const SUDDEN_SHARE = 0.4;
/** Back above this share of the speed before a drop, the car is racing again. */
const RECOVER_SHARE = 0.75;
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
/**
 * Seconds after a caution or formation ends before anyone is judged: at the
 * green the field is still at pace speed or launching from the grid.
 */
const QUIET_GRACE_S = 5;

interface CarHazardState {
  /** The car's own top speed within the last SUDDEN_WINDOW_S, and when. */
  peak: number;
  peakAt: number;
  /** Speed the car had before a sudden drop, or -1 while it has not dropped. */
  droppedFrom: number;
  droppedAt: number;
  /** Session time the car was last below STOPPED_MS, or -1 while it moves. */
  stoppedSince: number;
  /** Session time the car was last slow for the focus car, or -1. */
  slowSince: number;
  /** Session time the current excursion began, or -1. */
  offSince: number;
  /** The car's speed when the current excursion began. */
  offFrom: number;
  /** Session time the car last came back from a counted excursion, or -1. */
  rejoinedAt: number;
  /** The car's speed before that excursion. */
  rejoinFrom: number;
}

const freshState = (): CarHazardState => ({
  peak: 0,
  peakAt: -1,
  droppedFrom: -1,
  droppedAt: -1,
  stoppedSince: -1,
  slowSince: -1,
  offSince: -1,
  offFrom: 0,
  rejoinedAt: -1,
  rejoinFrom: 0,
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
  /** Judge nobody: full-course caution or a formation, when all are slow. */
  quiet: boolean;
}

/**
 * Finds cars ahead that are crashed, crawling, off the track or rejoining.
 *
 * Nothing here depends on the track or on car classes. A stopped car, an
 * excursion and a rejoin are facts about the car. A sudden drop from the
 * car's own recent speed is a crash or a spin, and a car far slower than the
 * focus car is slow; both only count while the focus car is closing in on
 * them fast enough to reach them soon, so a hairpin, a braking zone or a
 * slower class pulling away from nobody raises no alarm.
 */
export class RadarHazardTracker {
  private trackLength = 0;
  private readonly states = new Map<number, CarHazardState>();
  /** Session time the radar was last quiet. */
  private lastQuiet = -Infinity;

  setTrackLength(metres: number): void {
    if (metres === this.trackLength) return;
    this.trackLength = metres;
    this.states.clear();
  }

  /** Forget every car. */
  reset(): void {
    this.states.clear();
    this.lastQuiet = -Infinity;
  }

  update(frame: HazardFrame): RadarHazard[] {
    const hazards: RadarHazard[] = [];
    if (this.trackLength <= 0 || frame.settling) return hazards;
    const { time, pcts } = frame;
    // Nothing done under a caution or on the grid says anything afterwards.
    if (frame.quiet) {
      this.states.clear();
      this.lastQuiet = time;
      return hazards;
    }
    const sinceQuiet = time - this.lastQuiet;
    if (sinceQuiet >= 0 && sinceQuiet < QUIET_GRACE_S) return hazards;

    const focusSpeed = frame.speeds[frame.focus] ?? 0;
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
      const dist = wrapDelta(pct, frame.playerPct) * this.trackLength;
      const closing = focusSpeed - speed;
      const reachable =
        dist > 0 && closing >= CLOSING_MIN_MS && dist / closing <= REACH_MAX_S;
      const kind = this.judge(
        carIdx,
        speed,
        surface,
        time,
        focusSpeed,
        reachable
      );
      if (!kind || carIdx === frame.focus) continue;
      // Only what is still ahead: once passed, it no longer concerns us.
      if (dist < 0 || dist > RADAR_HAZARD_MAX_M) continue;
      hazards.push({ carIdx, dist, kind, speed });
    }
    hazards.sort((a, b) => a.dist - b.dist);
    return hazards;
  }

  private judge(
    carIdx: number,
    speed: number,
    surface: unknown,
    time: number,
    focusSpeed: number,
    reachable: boolean
  ): RadarHazardKind | null {
    let state = this.states.get(carIdx);
    if (!state) {
      state = freshState();
      this.states.set(carIdx, state);
    }

    // The car's own pace over the last moments, to tell a drop from a corner.
    if (speed >= state.peak || time - state.peakAt > SUDDEN_WINDOW_S) {
      state.peak = speed;
      state.peakAt = time;
    }
    if (
      state.droppedFrom < 0 &&
      state.peak >= RACING_MS &&
      speed < state.peak * SUDDEN_SHARE
    ) {
      state.droppedFrom = state.peak;
      state.droppedAt = time;
    } else if (
      state.droppedFrom >= 0 &&
      speed >= state.droppedFrom * RECOVER_SHARE
    ) {
      state.droppedFrom = -1;
    }

    const off = surface === TrackLocation.OffTrack;
    if (off) {
      if (state.offSince < 0) {
        state.offSince = time;
        state.offFrom = state.peak;
      }
    } else if (state.offSince >= 0) {
      if (time - state.offSince >= OFF_HOLD_S) {
        state.rejoinedAt = time;
        state.rejoinFrom = state.offFrom;
      }
      state.offSince = -1;
    }
    // Back at the speed it had before the excursion: racing again.
    if (state.rejoinedAt >= 0 && speed >= state.rejoinFrom * RECOVER_SHARE) {
      state.rejoinedAt = -1;
    }

    if (off) {
      return time - state.offSince >= OFF_HOLD_S ? 'off' : null;
    }
    if (state.rejoinedAt >= 0) {
      if (time - state.rejoinedAt <= REJOIN_S) return 'rejoin';
      state.rejoinedAt = -1;
    }

    if (speed < STOPPED_MS) {
      if (state.stoppedSince < 0) state.stoppedSince = time;
    } else {
      state.stoppedSince = -1;
    }
    if (state.stoppedSince >= 0 && time - state.stoppedSince >= SLOW_HOLD_S) {
      return 'crash';
    }
    if (
      state.droppedFrom >= 0 &&
      reachable &&
      time - state.droppedAt >= SUDDEN_HOLD_S
    ) {
      return 'crash';
    }

    const slow = reachable && speed < focusSpeed * SLOW_SHARE;
    if (!slow) {
      state.slowSince = -1;
      return null;
    }
    if (state.slowSince < 0) state.slowSince = time;
    return time - state.slowSince >= SLOW_HOLD_S ? 'slow' : null;
  }
}
