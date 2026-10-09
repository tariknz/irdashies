import { describe, expect, it } from 'vitest';
import {
  DiveTracker,
  overlapOf,
  type DiveContext,
  type DiveInput,
} from './radarHints';

describe('overlapOf', () => {
  it('is null while the bodies do not overlap along the track', () => {
    expect(overlapOf(-4.6, 4.5, 4.5)).toBeNull();
    expect(overlapOf(5, 4.5, 4.5)).toBeNull();
  });

  it('measures a car behind on our car, from our rear to its nose', () => {
    expect(overlapOf(-3.6, 4.5, 4.5)).toEqual({
      onRival: false,
      share: expect.closeTo(0.2, 5),
    });
    expect(overlapOf(0, 4.5, 4.5)).toEqual({ onRival: false, share: 1 });
  });

  it('measures a car ahead on its car, from its rear to our nose', () => {
    // We reach 2.25 m into a 4.5 m car whose centre is 2.25 m ahead.
    expect(overlapOf(2.25, 4.5, 4.5)).toEqual({
      onRival: true,
      share: expect.closeTo(0.5, 5),
    });
  });

  it('accounts for cars of different length', () => {
    // 1 m behind our 4 m car, a 4 m car reaches 3 m along it, a 5 m one 3.5.
    expect(overlapOf(-1, 4, 4)?.share).toBeCloseTo(0.75);
    expect(overlapOf(-1, 5, 4)?.share).toBeCloseTo(0.875);
  });
});

const ctx = (change: Partial<DiveContext> = {}): DiveContext => ({
  time: 0,
  playerLength: 4.5,
  playerSpeed: 40,
  brake: 0,
  cornerInside: 0,
  suppressed: false,
  minClosingKmh: 15,
  warnSeconds: 1.2,
  ...change,
});

const car = (change: Partial<DiveInput> = {}): DiveInput => ({
  carIdx: 1,
  dist: -15,
  closingSpeed: 7,
  lane: 0,
  length: 4.5,
  ...change,
});

describe('DiveTracker', () => {
  it('flags a car closing fast from behind as fast first', () => {
    // 10.5 m of gap at 7 m/s: 1.5 s, inside twice the 1.2 s warning.
    const hint = new DiveTracker().update([car()], ctx()).get(1);

    expect(hint).toMatchObject({ level: 'fast', side: 0 });
    expect(hint?.closingKmh).toBeCloseTo(25.2);
    expect(hint?.secondsToSide).toBeCloseTo(1.5);
  });

  it('leaves slow, far and already alongside cars alone', () => {
    const tracker = new DiveTracker();
    const hints = tracker.update(
      [
        car({ carIdx: 1, closingSpeed: 3 }),
        car({ carIdx: 2, dist: -60 }),
        car({ carIdx: 3, dist: -3 }),
        car({ carIdx: 4, dist: 10, closingSpeed: -9 }),
      ],
      ctx()
    );
    expect(hints.size).toBe(0);
  });

  it('turns into a dive on the corner inside when we brake', () => {
    const hint = new DiveTracker()
      .update([car({ dist: -10 })], ctx({ brake: 0.8, cornerInside: -1 }))
      .get(1);

    expect(hint).toMatchObject({ level: 'dive', side: -1 });
  });

  it('takes the lane a car already pulled out to over the corner', () => {
    const hint = new DiveTracker()
      .update([car({ dist: -10, lane: 0.8 })], ctx({ cornerInside: -1 }))
      .get(1);

    expect(hint).toMatchObject({ level: 'dive', side: 1 });
  });

  it('stays fast without braking or a side to dive to', () => {
    const hint = new DiveTracker().update([car({ dist: -10 })], ctx()).get(1);
    expect(hint?.level).toBe('fast');
  });

  it('holds a dive briefly so it cannot flicker', () => {
    const tracker = new DiveTracker();
    tracker.update([car({ dist: -10 })], ctx({ brake: 0.8 }));

    expect(
      tracker.update([car({ dist: -9.9 })], ctx({ time: 0.2 })).get(1)?.level
    ).toBe('dive');
    expect(
      tracker.update([car({ dist: -9.8 })], ctx({ time: 0.6 })).get(1)?.level
    ).toBe('fast');
  });

  it('is quiet when suppressed or when we are barely moving', () => {
    const tracker = new DiveTracker();
    expect(tracker.update([car()], ctx({ suppressed: true })).size).toBe(0);
    expect(tracker.update([car()], ctx({ playerSpeed: 3 })).size).toBe(0);
  });
});
