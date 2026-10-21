import {
  tangentAtProgress,
  type TrackGeometry,
  type TrackPathPoint,
} from '@irdashies/domain/track';
import type { RadarOverlapThreshold } from '@irdashies/types';

/** Share of a car's length, from its rear, where each mark sits. */
export const OVERLAP_MARKS: Readonly<Record<RadarOverlapThreshold, number>> = {
  rearWheel: 0.2,
  door: 0.5,
  frontWheel: 0.8,
};

export interface Overlap {
  /**
   * Whose side the strip belongs on: ours when the rival is level or behind
   * (we defend), theirs when it is ahead (we attack).
   */
  onRival: boolean;
  /** 0..1 of the measured car's length, from its rear. */
  share: number;
}

/**
 * How far alongside a rival is, or null when the bodies do not overlap
 * along the track. A rival behind is measured on our car, from our rear to
 * its nose; a rival ahead is measured on its car, from its rear to our nose.
 */
export const overlapOf = (
  dist: number,
  rivalLength: number,
  playerLength: number
): Overlap | null => {
  if (Math.abs(dist) >= (rivalLength + playerLength) / 2) return null;
  if (dist <= 0) {
    const reach = dist + rivalLength / 2 + playerLength / 2;
    return { onRival: false, share: Math.min(reach / playerLength, 1) };
  }
  const reach = playerLength / 2 - dist + rivalLength / 2;
  return { onRival: true, share: Math.min(reach / rivalLength, 1) };
};

/**
 * Lane sign of the inside of the next corner, -1 left or +1 right (as
 * RadarCar.lane), or 0 on a straight or without a track drawing.
 */
export const cornerInside = (
  geometry: TrackGeometry | null,
  trackLength: number,
  playerPct: number,
  aheadM: number,
  minTurnDeg = 20
): number => {
  if (!geometry || trackLength <= 0) return 0;
  tangentAtProgress(geometry, playerPct, here);
  tangentAtProgress(geometry, playerPct + aheadM / trackLength, there);
  // Left of travel in y-down drawing coordinates, as in RadarProjector.
  const left = there.x * here.y - there.y * here.x;
  const ahead = there.x * here.x + there.y * here.y;
  const turnDeg = (Math.atan2(left, ahead) * 180) / Math.PI;
  if (Math.abs(turnDeg) < minTurnDeg) return 0;
  return turnDeg > 0 ? -1 : 1;
};

const here: TrackPathPoint = { x: 0, y: -1 };
const there: TrackPathPoint = { x: 0, y: -1 };

export interface DiveInput {
  carIdx: number;
  dist: number;
  /** Rate of change of `dist`; for a car behind, positive closes in. */
  closingSpeed: number;
  lane: number;
  length: number;
}

export interface DiveContext {
  /** Seconds, any clock. */
  time: number;
  playerLength: number;
  playerSpeed: number;
  /** 0..1, or null when unknown. */
  brake: number | null;
  /** Lane sign of the inside of the corner ahead, 0 if none. */
  cornerInside: number;
  /** Position fights are off: caution, formation, pit road. */
  suppressed: boolean;
  minClosingKmh: number;
  warnSeconds: number;
}

export interface DiveHint {
  /** `fast`: closing hard; `dive`: about to arrive at our side. */
  level: 'fast' | 'dive';
  /** km/h. */
  closingKmh: number;
  /** Seconds until the bodies overlap. */
  secondsToSide: number;
  /** Lane sign of the side it is diving to, 0 if unknown. */
  side: number;
}

/** Brake pedal above this counts as braking for a corner. */
const BRAKING = 0.3;
/** A car this far into a side lane has picked that side. */
const SIDE_LANE = 0.3;
/** How long a dive warning outlives what caused it, so it cannot flicker. */
const HOLD_S = 0.4;
/** Below this we are not racing anyone (pit exit, a spin, the grid). */
const MIN_PLAYER_SPEED_MS = 8;
/** Fast cars are flagged from this many times `warnSeconds` out. */
const FAST_LOOKAHEAD = 2;

/**
 * Spots a car coming up behind much faster than us, before it gets there.
 *
 * iRacing gives no lateral position for other cars, so the side it will
 * arrive on is a guess: the lane it is already drawn in (the spotter or
 * memory put it there), else the inside of the corner we are braking for,
 * which is where a late lunge goes.
 */
export class DiveTracker {
  private readonly held = new Map<number, { hint: DiveHint; until: number }>();
  private readonly hints = new Map<number, DiveHint>();

  update(
    cars: readonly DiveInput[],
    ctx: DiveContext
  ): ReadonlyMap<number, DiveHint> {
    this.hints.clear();
    if (ctx.suppressed || ctx.playerSpeed < MIN_PLAYER_SPEED_MS) {
      this.held.clear();
      return this.hints;
    }
    const minClosing = ctx.minClosingKmh / 3.6;
    const braking = (ctx.brake ?? 0) > BRAKING;
    const seen = new Set<number>();
    for (const car of cars) {
      seen.add(car.carIdx);
      const gap = -car.dist - (car.length + ctx.playerLength) / 2;
      // Only cars still behind us; once alongside the usual warning takes over.
      if (car.dist >= 0 || gap <= 0) {
        this.held.delete(car.carIdx);
        continue;
      }
      const fresh = this.judge(car, gap, minClosing, braking, ctx);
      const stored = this.held.get(car.carIdx);
      const held = stored && stored.until > ctx.time ? stored : undefined;
      // A dive stays a dive for HOLD_S even if this frame only says fast.
      if (fresh && (fresh.level === 'dive' || held?.hint.level !== 'dive')) {
        this.held.set(car.carIdx, { hint: fresh, until: ctx.time + HOLD_S });
        this.hints.set(car.carIdx, fresh);
      } else if (held) {
        held.hint.closingKmh = Math.max(car.closingSpeed, 0) * 3.6;
        held.hint.secondsToSide =
          car.closingSpeed > 0 ? gap / car.closingSpeed : Infinity;
        this.hints.set(car.carIdx, held.hint);
      } else {
        this.held.delete(car.carIdx);
      }
    }
    for (const carIdx of this.held.keys()) {
      if (!seen.has(carIdx)) this.held.delete(carIdx);
    }
    return this.hints;
  }

  reset(): void {
    this.held.clear();
    this.hints.clear();
  }

  private judge(
    car: DiveInput,
    gap: number,
    minClosing: number,
    braking: boolean,
    ctx: DiveContext
  ): DiveHint | null {
    if (car.closingSpeed < minClosing) return null;
    const secondsToSide = gap / car.closingSpeed;
    if (secondsToSide > ctx.warnSeconds * FAST_LOOKAHEAD) return null;
    const laneSide = Math.abs(car.lane) >= SIDE_LANE ? Math.sign(car.lane) : 0;
    const side = laneSide || (braking ? ctx.cornerInside : 0);
    const diving =
      secondsToSide <= ctx.warnSeconds && (braking || laneSide !== 0);
    return {
      level: diving ? 'dive' : 'fast',
      closingKmh: car.closingSpeed * 3.6,
      secondsToSide,
      side,
    };
  }
}
