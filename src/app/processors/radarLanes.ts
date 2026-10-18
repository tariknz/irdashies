import {
  CarLeftRight,
  DEFAULT_RADAR_TUNING,
  type RadarProcessorTuning,
} from '@irdashies/types';

import type { RadarCar } from '@irdashies/types';

export type RadarLaneSource = RadarCar['laneSource'];

export interface LaneInput {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
}

export interface LaneOutput {
  /** Smoothed lane in car widths, negative is left. */
  lane: number;
  source: RadarLaneSource;
}

/**
 * A rival this close along the track overlaps us, so the spotter is talking
 * about it. A little longer than a car so lap-distance noise cannot drop a
 * car that is still alongside.
 */
export const OVERLAP_M = 5.5;
/** Two rivals closer than this to each other must be side by side. */
export const PAIR_M = 4;
/**
 * Two cars in one lane cannot be closer than a body length along the track,
 * so one that is, with no side from the spotter, is drawn this far off.
 */
export const IN_LANE_GAP_M = 5;
/** Distances this close, in metres, count as equally near when ranking. */
const NEAR_BAND_M = 1.5;
/** How long a side learnt from the spotter is kept after the overlap ends. */
export const MEMORY_HOLD_S = 3;
const MAX_LANE = 2;

interface SpotterDemand {
  left: number;
  right: number;
}

const demandFor = (carLeftRight: number): SpotterDemand | null => {
  switch (carLeftRight) {
    case CarLeftRight.Clear:
      return { left: 0, right: 0 };
    case CarLeftRight.CarLeft:
      return { left: 1, right: 0 };
    case CarLeftRight.CarRight:
      return { left: 0, right: 1 };
    case CarLeftRight.CarLeftRight:
      return { left: 1, right: 1 };
    case CarLeftRight.Cars2Left:
      return { left: 2, right: 0 };
    case CarLeftRight.Cars2Right:
      return { left: 0, right: 2 };
    default:
      // Off: the spotter is silent (not driving, or watching another car).
      return null;
  }
};

export type FormationKind = 'grid' | 'pace';
/**
 * Pole column side: on the left of a standing grid; for a pace line it
 * depends on the track, see paceFieldPoleLeft. iRacing does not say; this is
 * what its grids do. +1 means the pole is on the left, so higher columns lie
 * to the right.
 */
const poleSign = (kind: FormationKind, pacePoleLeft: boolean): number =>
  kind === 'grid' || pacePoleLeft ? 1 : -1;

export interface LaneFormation {
  kind: FormationKind;
  /** Column or line minus ours, counted away from the pole side. */
  slots: ReadonlyMap<number, number>;
}

const clampLane = (lane: number) =>
  Math.max(-MAX_LANE, Math.min(MAX_LANE, lane));

/**
 * Estimates which lane each nearby rival is in.
 *
 * iRacing publishes no lateral positions. What it does publish is the
 * spotter's verdict for the player — car left, car right, two cars left —
 * and every car's distance along the track. Combining them:
 *
 * 1. Rivals overlapping us take the sides the spotter calls, keeping any side
 *    they already had where possible.
 * 2. A side outlives the overlap for MEMORY_HOLD_S, so a car that just passed
 *    on the left is still drawn on the left; after that it drifts back to the
 *    centre, since a lane change cannot be observed.
 * 3. Rivals too close to each other to be nose to tail are spread across
 *    lanes. Which of them is left is unknown until one comes alongside us,
 *    so the order is only kept stable, anchored on any remembered side.
 *
 * In formation — on a standing grid or behind the pace car — the slots
 * the sim gives win over all of that: they are known, not guessed, and the
 * pole side comes from poleSign.
 *
 * Everything else sits in our lane. Drawn lanes move at `laneRate` lanes per
 * second so a corrected guess slides rather than jumps.
 *
 * Tuning, see RadarTuning: `overlapSearchM` is the fallback search when the
 * spotter reports more cars than sit in OVERLAP_M.
 */
export class RadarLaneTracker {
  private readonly rememberedLane = new Map<number, number>();
  private readonly rememberedAt = new Map<number, number>();
  private readonly drawnLane = new Map<number, number>();
  private previousTime = -1;
  private pacePoleLeft = false;
  constructor(
    private readonly tuning: () => RadarProcessorTuning = () =>
      DEFAULT_RADAR_TUNING
  ) {}

  /** Which side the pole line of a pace field is on, see paceFieldPoleLeft. */
  setPacePoleLeft(left: boolean): void {
    this.pacePoleLeft = left;
  }

  reset(): void {
    this.rememberedLane.clear();
    this.rememberedAt.clear();
    this.drawnLane.clear();
    this.previousTime = -1;
  }

  /**
   * @param carLeftRight the spotter's verdict, or null when it does not
   *   describe the focus car (spectating someone else)
   */
  update(
    time: number,
    cars: readonly LaneInput[],
    carLeftRight: number | null,
    formation: LaneFormation | null = null
  ): Map<number, LaneOutput> {
    if (this.previousTime >= 0 && time < this.previousTime) this.reset();
    const dt =
      this.previousTime < 0 ? Infinity : Math.max(0, time - this.previousTime);
    this.previousTime = time;

    const targets = new Map<number, LaneOutput>();
    const demand = carLeftRight === null ? null : demandFor(carLeftRight);
    if (formation) this.applyFormation(time, cars, formation, targets);
    if (demand) this.applySpotter(time, cars, demand, targets);

    const remembered = (carIdx: number): number | undefined => {
      const at = this.rememberedAt.get(carIdx);
      if (at === undefined || time - at > MEMORY_HOLD_S) return undefined;
      return this.rememberedLane.get(carIdx);
    };

    for (const car of cars) {
      if (targets.has(car.carIdx)) continue;
      const lane = remembered(car.carIdx);
      if (lane !== undefined)
        targets.set(car.carIdx, { lane, source: 'memory' });
    }

    this.spreadPairs(cars, targets, remembered);

    const output = new Map<number, LaneOutput>();
    const seen = new Set<number>();
    for (const car of cars) {
      seen.add(car.carIdx);
      const target = targets.get(car.carIdx) ?? { lane: 0, source: 'none' };
      const previous = this.drawnLane.get(car.carIdx);
      let lane = target.lane;
      if (previous !== undefined && Number.isFinite(dt)) {
        const step = this.tuning().laneRate * dt;
        lane =
          previous + Math.max(-step, Math.min(step, target.lane - previous));
      }
      this.drawnLane.set(car.carIdx, lane);
      output.set(car.carIdx, { lane, source: target.source });
    }
    for (const carIdx of this.drawnLane.keys()) {
      if (!seen.has(carIdx)) this.drawnLane.delete(carIdx);
    }
    for (const [carIdx, at] of this.rememberedAt) {
      if (time - at > MEMORY_HOLD_S) {
        this.rememberedAt.delete(carIdx);
        this.rememberedLane.delete(carIdx);
      }
    }
    return output;
  }

  private applySpotter(
    time: number,
    cars: readonly LaneInput[],
    spotterDemand: SpotterDemand,
    targets: Map<number, LaneOutput>
  ): void {
    let demand = spotterDemand;
    // Formation cars alongside already fill some of the sides it calls.
    for (const car of cars) {
      const target = targets.get(car.carIdx);
      if (!target || Math.abs(car.dist) > OVERLAP_M) continue;
      if (target.lane <= -0.5 && demand.left > 0) {
        demand = { ...demand, left: demand.left - 1 };
      } else if (target.lane >= 0.5 && demand.right > 0) {
        demand = { ...demand, right: demand.right - 1 };
      }
    }
    if (demand.left + demand.right === 0) return;
    const wanted = demand.left + demand.right;
    const free = cars.filter((car) => !targets.has(car.carIdx));
    let candidates = free.filter((car) => Math.abs(car.dist) <= OVERLAP_M);
    if (candidates.length < wanted) {
      const search = this.tuning().overlapSearchM;
      candidates = free.filter((car) => Math.abs(car.dist) <= search);
    }
    const sideOf = (carIdx: number) => {
      const lane = this.rememberedLane.get(carIdx);
      return lane === undefined ? 0 : Math.sign(lane);
    };
    const taken = new Set<number>();

    const fill = (count: number, side: -1 | 1) => {
      if (count === 0) return;
      // The nearest cars are the ones the spotter sees. Among cars about as
      // near, those already known on this side first, then unknown, then the
      // far side; a remembered car that has dropped back loses its place to
      // one that is now alongside.
      const ranked = candidates
        .filter((car) => !taken.has(car.carIdx))
        .sort((a, b) => {
          const rank = (car: LaneInput) =>
            sideOf(car.carIdx) === side ? 0 : sideOf(car.carIdx) === 0 ? 1 : 2;
          const band = (car: LaneInput) =>
            Math.floor(Math.abs(car.dist) / NEAR_BAND_M);
          return (
            band(a) - band(b) ||
            rank(a) - rank(b) ||
            Math.abs(a.dist) - Math.abs(b.dist) ||
            a.carIdx - b.carIdx
          );
        })
        .slice(0, count);
      // With two on one side, keep a remembered outer car outside.
      ranked.sort((a, b) => {
        const outer = (car: LaneInput) =>
          Math.abs(this.rememberedLane.get(car.carIdx) ?? 0) >= 2 ? 1 : 0;
        return outer(a) - outer(b) || Math.abs(a.dist) - Math.abs(b.dist);
      });
      ranked.forEach((car, index) => {
        const lane = side * (index + 1);
        taken.add(car.carIdx);
        targets.set(car.carIdx, { lane, source: 'spotter' });
        this.rememberedLane.set(car.carIdx, lane);
        this.rememberedAt.set(car.carIdx, time);
      });
    };

    fill(demand.left, -1);
    fill(demand.right, 1);
  }

  private applyFormation(
    time: number,
    cars: readonly LaneInput[],
    formation: LaneFormation,
    targets: Map<number, LaneOutput>
  ): void {
    for (const car of cars) {
      const slot = formation.slots.get(car.carIdx);
      if (slot === undefined) continue;
      const lane = clampLane(
        slot * poleSign(formation.kind, this.pacePoleLeft)
      );
      targets.set(car.carIdx, { lane, source: formation.kind });
      // Remembered too, so the formation fades out gently after the green.
      this.rememberedLane.set(car.carIdx, lane);
      this.rememberedAt.set(car.carIdx, time);
    }
  }

  private spreadPairs(
    cars: readonly LaneInput[],
    targets: Map<number, LaneOutput>,
    remembered: (carIdx: number) => number | undefined
  ): void {
    // Cars alongside us are the spotter's business, not a pair's.
    const free = cars
      .filter(
        (car) =>
          (targets.get(car.carIdx)?.source ?? 'memory') === 'memory' &&
          Math.abs(car.dist) > OVERLAP_M
      )
      .sort((a, b) => a.dist - b.dist);

    let start = 0;
    while (start < free.length) {
      let end = start + 1;
      while (
        end < free.length &&
        free[end].dist - free[end - 1].dist < PAIR_M
      ) {
        end += 1;
      }
      const group = free.slice(start, end);
      start = end;
      if (group.length < 2) continue;

      // Every member already has its own remembered lane: nothing to guess.
      const lanes = group.map((car) => remembered(car.carIdx));
      if (
        lanes.every((lane) => lane !== undefined) &&
        new Set(lanes).size === lanes.length
      ) {
        continue;
      }

      group.sort(
        (a, b) =>
          (remembered(a.carIdx) ?? 0) - (remembered(b.carIdx) ?? 0) ||
          a.carIdx - b.carIdx
      );
      const anchorIndex = group.findIndex(
        (car) => remembered(car.carIdx) !== undefined
      );
      const anchorLane =
        anchorIndex >= 0
          ? (remembered(group[anchorIndex].carIdx) ?? 0)
          : -(group.length - 1) / 2;
      const offset = anchorIndex >= 0 ? anchorIndex : 0;
      group.forEach((car, index) => {
        const lane = clampLane(anchorLane + index - offset);
        targets.set(car.carIdx, { lane, source: 'pair' });
      });
    }
  }
}

/**
 * Pushes cars that overlap the focus car along the track out to a body
 * length when nothing says they are beside it. The spotter is silent about
 * them, so they are not alongside; the overlap is noise in lap distance, and
 * drawing them on top of the focus car is worse than drawing them nose to
 * tail. Pass only cars on the focus car's side of the pit wall.
 */
export const separateInLaneCars = (
  cars: { dist: number; lane: number; laneSource: string }[]
): void => {
  for (const car of cars) {
    if (
      car.laneSource === 'none' &&
      Math.abs(car.lane) < 0.5 &&
      Math.abs(car.dist) < IN_LANE_GAP_M
    ) {
      car.dist = (car.dist < 0 ? -1 : 1) * IN_LANE_GAP_M;
    }
  }
};
