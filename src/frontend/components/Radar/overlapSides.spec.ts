import { describe, expect, it } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import {
  assignOverlapSides,
  overlapFromCarLeftRight,
  type OverlapCandidate,
  type OverlapSide,
  type RadarOverlap,
} from './overlapSides';

describe('assignOverlapSides', () => {
  const blips = (...along: number[]): OverlapCandidate[] =>
    along.map((alongM, index) => ({ carIdx: index + 1, alongM }));
  /** The widget's cars are far more than these tests use, so size generously. */
  const CARS = 8;

  /**
   * Drives the assignment the way the widget does: a zeroed output array and
   * the previous frame's sides, read back through the array the call filled.
   */
  const assign = (
    candidates: OverlapCandidate[],
    overlap: RadarOverlap,
    previous: Record<number, OverlapSide> = {}
  ) => {
    const previousSides = new Int8Array(CARS);
    for (const [carIdx, side] of Object.entries(previous)) {
      previousSides[Number(carIdx)] = side;
    }
    const sides = new Int8Array(CARS);
    assignOverlapSides({
      blips: candidates,
      overlap,
      vehicleLength: 4.5,
      previousSides,
      sides,
    });
    return sides;
  };

  const sideOf = (sides: Int8Array, carIdx: number) =>
    sides[carIdx] === 0 ? undefined : sides[carIdx];
  const sidesGiven = (sides: Int8Array) =>
    [...sides].filter((side) => side !== 0);

  it('puts the only car abreast on the side the sim reports', () => {
    const left = assign(blips(0.4), { left: 1, right: 0 });
    expect(sideOf(left, 1)).toBe(-1);

    const right = assign(blips(0.4), { left: 0, right: 1 });
    expect(sideOf(right, 1)).toBe(1);
  });

  it('assigns the nearer car first when several are abreast', () => {
    const sides = assign(blips(7, 0.5), { left: 1, right: 0 });

    // carIdx 2 is the nearer of the two, so it takes the reported slot.
    expect(sideOf(sides, 2)).toBe(-1);
    expect(sideOf(sides, 1)).toBeUndefined();
  });

  it('puts two cars on the same side when the sim reports two', () => {
    const sides = assign(blips(-0.5, 0.5), { left: 2, right: 0 });

    expect(sideOf(sides, 1)).toBe(-1);
    expect(sideOf(sides, 2)).toBe(-1);
  });

  it('separates a car on each side', () => {
    const sides = assign(blips(-0.5, 0.5), { left: 1, right: 1 });
    expect(sidesGiven(sides).sort()).toEqual([-1, 1]);
  });

  it('keeps the side a car already had when the verdict flickers to clear', () => {
    const sides = assign(blips(-0.5), { left: 0, right: 0 }, { 1: -1 });
    expect(sideOf(sides, 1)).toBe(-1);
  });

  it('follows the sim when it reports the opposite side to the one held', () => {
    // A car that has crossed to the other side can do it without ever leaving
    // the retain window, so the held side goes stale mid-pass and the blip and
    // its warning end up on the wrong side.
    const crossedToRight = assign(blips(1), { left: 0, right: 1 }, { 1: -1 });
    expect(sideOf(crossedToRight, 1)).toBe(1);

    const crossedToLeft = assign(blips(-1), { left: 1, right: 0 }, { 1: 1 });
    expect(sideOf(crossedToLeft, 1)).toBe(-1);
  });

  it('leaves a held side alone when the opposite slot is already taken', () => {
    // Two cars across, each already on a side: the verdict counts them back
    // where they are, and there is no free slot that would move either.
    const sides = assign(
      blips(-0.5, 0.5),
      { left: 1, right: 1 },
      { 1: -1, 2: 1 }
    );
    expect(sidesGiven(sides).sort()).toEqual([-1, 1]);
  });

  it('does not move a car when the verdict still names the side it holds', () => {
    // A verdict reporting one car on each side says nothing about which of the
    // two moved, so each keeps the side it holds. Letting the free slot on the
    // other side pull a car across meant a blip hopped the player at the
    // snapshot rate, which is the flicker the retain window exists to absorb.
    const oneEach = assign(
      blips(0.4, -0.4),
      { left: 1, right: 1 },
      {
        1: -1,
        2: 1,
      }
    );
    expect(sideOf(oneEach, 1)).toBe(-1);
    expect(sideOf(oneEach, 2)).toBe(1);

    // The same reading with a spare slot on the held side of the first car.
    const twoLeft = assign(
      blips(0.4, -0.4),
      { left: 2, right: 0 },
      {
        1: -1,
      }
    );
    expect(sidesGiven(twoLeft).sort()).toEqual([-1, -1]);
  });

  it('does not let a car beyond the alongside window consume a fresh slot', () => {
    const sides = assign(blips(12, 0.4), { left: 1, right: 0 }, { 1: -1 });

    // The old side remains available for the offset ramp, but the reported slot
    // belongs to the car the sim is describing now.
    expect(sideOf(sides, 1)).toBe(-1);
    expect(sideOf(sides, 2)).toBe(-1);
  });

  it('drops a held side once the car is clear in either direction', () => {
    const sides = assign(blips(20), { left: 0, right: 0 }, { 1: -1 });
    expect(sidesGiven(sides)).toEqual([]);
  });

  it('claims no side when the sim reports no overlap', () => {
    const sides = assign(blips(0.5), { left: 0, right: 0 });
    expect(sidesGiven(sides)).toEqual([]);
  });

  it('does not give a far car a side even when slots are free', () => {
    const sides = assign(blips(12), { left: 1, right: 0 });
    expect(sidesGiven(sides)).toEqual([]);
  });

  it('leaves a side held by a car it was not given this frame', () => {
    // The output is the caller's to clear, not this function's to scope: a
    // car outside the retain window keeps whatever the array already held, so
    // a stale entry would survive if the caller did not zero it first.
    const sides = new Int8Array(CARS);
    sides[4] = 1;
    assignOverlapSides({
      blips: blips(0.5),
      overlap: { left: 1, right: 0 },
      vehicleLength: 4.5,
      previousSides: new Int8Array(CARS),
      sides,
    });

    expect(sideOf(sides, 4)).toBe(1);
    expect(sideOf(sides, 1)).toBe(-1);
  });
});

describe('overlapFromCarLeftRight', () => {
  it.each([
    [CarLeftRight.Off, 0, 0],
    [CarLeftRight.Clear, 0, 0],
    [CarLeftRight.CarLeft, 1, 0],
    [CarLeftRight.CarRight, 0, 1],
    [CarLeftRight.CarLeftRight, 1, 1],
    [CarLeftRight.Cars2Left, 2, 0],
    [CarLeftRight.Cars2Right, 0, 2],
  ])('maps state %i to %i cars left and %i right', (state, left, right) => {
    expect(overlapFromCarLeftRight(state)).toEqual({ left, right });
  });

  it('treats an unknown state as no overlap rather than a side', () => {
    expect(overlapFromCarLeftRight(99)).toEqual({ left: 0, right: 0 });
  });
});
