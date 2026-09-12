import { describe, it, expect } from 'vitest';
import type { BrakeCueSound } from '@irdashies/types';
import {
  BRAKE_CUE_ARM_SEC,
  BRAKE_CUE_HOLD_SEC,
  createBrakeCueLatch,
  createBrakeCueOutput,
  levelForSeconds,
  stepBrakeCueLatch,
  type BrakeCueLatchState,
  type BrakeCueOutput,
} from './brakeCueLatch';

const TRACK_LENGTH_M = 5000;
const SPEED_MS = 50;

/** A rig that drives the latch and records what it fired and showed. */
const rig = (cuePointsM: number[] = [1000], audioCueLeadSec = 0) => {
  const state = createBrakeCueLatch();
  const out = createBrakeCueOutput();
  const points = new Float32Array(cuePointsM);
  const fired: BrakeCueSound[] = [];
  let sessionTime = 0;

  const tick = (
    carDistanceM: number,
    speedMs = SPEED_MS,
    overrides: Partial<{
      sessionTime: number;
      driving: boolean;
      referenceSpeedMs: number;
    }> = {}
  ): BrakeCueOutput => {
    sessionTime = overrides.sessionTime ?? sessionTime + 0.1;
    stepBrakeCueLatch(state, out, {
      carDistanceM,
      speedMs,
      sessionTime,
      trackLengthM: TRACK_LENGTH_M,
      cuePointsM: points,
      cuePointCount: points.length,
      referenceSpeedMs: overrides.referenceSpeedMs ?? 0,
      audioCueLeadSec,
      driving: overrides.driving ?? true,
    });
    if (out.fire) fired.push(out.fire);
    return out;
  };

  /**
   * Put the car at `atM` and let the machine settle: the very first tick only
   * seeds the previous-position reference, so a second is needed before any
   * target is acquired.
   */
  const start = (atM: number, speed = SPEED_MS) => {
    tick(atM, speed);
    return tick(atM, speed);
  };

  /** Approach the point from `fromM` to `toM` in even steps. */
  const approach = (
    fromM: number,
    toM: number,
    steps = 40,
    speed = SPEED_MS
  ) => {
    for (let i = 0; i <= steps; i++) {
      tick(fromM + ((toM - fromM) * i) / steps, speed);
    }
  };

  return {
    state,
    out,
    fired,
    tick,
    start,
    approach,
    get sessionTime() {
      return sessionTime;
    },
  };
};

describe('levelForSeconds', () => {
  it('maps the countdown onto the bar ladder', () => {
    expect(levelForSeconds(4)).toBe(4);
    expect(levelForSeconds(3)).toBe(3);
    expect(levelForSeconds(2.5)).toBe(3);
    expect(levelForSeconds(2)).toBe(2);
    expect(levelForSeconds(1)).toBe(1);
    expect(levelForSeconds(0.2)).toBe(1);
    expect(levelForSeconds(0)).toBe(0);
    expect(levelForSeconds(-1)).toBe(0);
  });

  it('shows nothing beyond the arm window or without a usable estimate', () => {
    expect(levelForSeconds(6)).toBe(-1);
    expect(levelForSeconds(Number.POSITIVE_INFINITY)).toBe(-1);
    expect(levelForSeconds(NaN)).toBe(-1);
  });
});

describe('stepBrakeCueLatch', () => {
  it('fires each cue exactly once, in order, on a clean approach', () => {
    const r = rig([1000]);
    // 700m out at 50 m/s is 4s, comfortably before the first cue.
    r.approach(700, 1010, 120);

    expect(r.fired).toEqual(['count3', 'count2', 'count1', 'brake']);
  });

  it('advances every audio cue by the configured lead time', () => {
    const r = rig([1000], 0.6);
    r.start(700); // 6s away: outside both countdowns.

    r.tick(820); // 3.6s away: count3 sounds, but bars remain at 4.
    expect(r.fired).toEqual(['count3']);
    expect(r.out.bars).toBe(4);

    r.tick(870); // 2.6s away
    r.tick(920); // 1.6s away
    r.tick(970); // 0.6s away
    expect(r.fired).toEqual(['count3', 'count2', 'count1', 'brake']);
  });

  it('drains the bars and warms their colour as it counts down', () => {
    const r = rig([1000]);

    // 220m at 50 m/s is 4.4s — inside the 5s window, before the first cue.
    r.start(780);
    expect(r.out.bars).toBe(4);
    expect(r.out.tone).toBe('green');

    r.tick(860); // 2.8s
    expect(r.out.bars).toBe(3);
    expect(r.out.tone).toBe('green');

    r.tick(920); // 1.6s
    expect(r.out.bars).toBe(2);
    expect(r.out.tone).toBe('amber');

    r.tick(970); // 0.6s
    expect(r.out.bars).toBe(1);
    expect(r.out.tone).toBe('orange');

    r.tick(1001); // past it
    expect(r.out.bars).toBe(1);
    expect(r.out.tone).toBe('red');
  });

  it('holds the red state for one full second', () => {
    expect(BRAKE_CUE_HOLD_SEC).toBe(1.0);
  });

  it('reports the metres remaining as it counts down', () => {
    const r = rig([1000]);

    r.start(780); // 220m out
    expect(r.out.distanceM).toBeCloseTo(220, 5);

    r.tick(970); // 30m out
    expect(r.out.distanceM).toBeCloseTo(30, 5);

    r.tick(1001); // past it, holding red
    expect(r.out.distanceM).toBe(0);
  });

  it('reports progress from 0 at the arm distance up to 1 at the target', () => {
    const r = rig([1000]);
    const armDistanceM = SPEED_MS * BRAKE_CUE_ARM_SEC;

    r.start(780); // 220m out
    expect(r.out.progress).toBeCloseTo(1 - 220 / armDistanceM, 5);

    r.tick(970); // 30m out
    expect(r.out.progress).toBeCloseTo(1 - 30 / armDistanceM, 5);

    r.tick(1001); // past it — held at full progress through the red hold
    expect(r.out.progress).toBe(1);
  });

  it('clears distance and progress once the strip goes dark', () => {
    const r = rig([1000]);

    // 600m out at 50 m/s is 12s — acquired, but nothing to show yet.
    r.start(400);
    expect(r.out.bars).toBe(0);
    expect(Number.isFinite(r.out.distanceM)).toBe(false);
    expect(r.out.progress).toBe(0);
  });

  it('stays dark until the point is inside the arm window', () => {
    const r = rig([1000]);

    // 600m at 50 m/s is 12s away — acquired, but nothing to show yet.
    r.start(400);
    expect(r.out.bars).toBe(0);

    // Close in — steps stay well under the teleport threshold.
    r.tick(560);
    r.tick(700);
    expect(r.out.bars).toBe(0);

    // 200m is 4s: inside the window, so the full stack appears.
    expect(r.tick(800).bars).toBe(4);
  });

  it('does not re-fire or restore a bar when the driver lifts', () => {
    const r = rig([1000]);
    r.approach(700, 970, 60); // down to ~0.6s, count1 fired

    expect(r.fired).toEqual(['count3', 'count2', 'count1']);
    expect(r.out.bars).toBe(1);

    // Lift: same place, much slower, so the estimate stretches back to ~1.7s.
    r.tick(975, 15);
    r.tick(978, 15);

    expect(r.fired).toEqual(['count3', 'count2', 'count1']);
    expect(r.out.bars).toBe(1);
    expect(r.out.tone).toBe('orange');
  });

  it('fires only the level actually entered when one is skipped', () => {
    const r = rig([1000]);
    r.start(780); // 4.4s out, 4 bars
    r.tick(930); // one big step straight to ~1.4s, skipping level 3

    expect(r.fired).toEqual(['count2']);
    expect(r.out.bars).toBe(2);
  });

  it('holds the red state, then clears and re-arms for the next point', () => {
    const r = rig([1000, 2000]);
    r.approach(700, 1005, 120);
    expect(r.out.tone).toBe('red');

    // Still inside the hold window.
    r.tick(1010, SPEED_MS, { sessionTime: r.sessionTime + 0.2 });
    expect(r.out.tone).toBe('red');

    // Past it.
    r.tick(1020, SPEED_MS, {
      sessionTime: r.sessionTime + BRAKE_CUE_HOLD_SEC + 0.1,
    });
    expect(r.out.bars).toBe(0);

    // The next point counts down normally.
    r.approach(1700, 2010, 120);
    expect(r.fired).toEqual([
      'count3',
      'count2',
      'count1',
      'brake',
      'count3',
      'count2',
      'count1',
      'brake',
    ]);
  });

  it('gives a chicane only the beep for its second point, not a second count', () => {
    // The two halves of Imola's Variante Villeneuve are a second and a bit
    // apart: the second point is acquired already inside the ladder, with the
    // driver still braking for the first. Counting them down again on top of
    // the beep just fired is noise, so only the point itself sounds.
    const r = rig([1000, 1075]);
    r.approach(700, 1005, 120);
    expect(r.fired).toEqual(['count3', 'count2', 'count1', 'brake']);

    // Clear the red hold, which acquires the second point 25 m ahead.
    r.tick(1050, SPEED_MS, {
      sessionTime: r.sessionTime + BRAKE_CUE_HOLD_SEC + 0.1,
    });
    r.approach(1050, 1080, 20);

    expect(r.fired).toEqual(['count3', 'count2', 'count1', 'brake', 'brake']);
  });

  it('still walks the bars down for a point it will not count out loud', () => {
    // Only the beeps are held back — the strip is the driver's read on how far
    // away the point is, and it is no less true for being close.
    const r = rig([1000, 1075]);
    r.approach(700, 1005, 120);
    r.tick(1050, SPEED_MS, {
      sessionTime: r.sessionTime + BRAKE_CUE_HOLD_SEC + 0.1,
    });

    expect(r.tick(1060).bars).toBeGreaterThan(0);
  });

  it('freezes the ladder rather than winding it back when nearly stopped', () => {
    const r = rig([1000]);
    r.approach(700, 940, 60);
    const levelBefore = r.out.bars;
    expect(levelBefore).toBe(2);
    const progressBefore = r.out.progress;

    // Crawling: the estimate is unusable, so the ladder must hold where it is.
    r.tick(941, 0.5);
    r.tick(942, 0.5);

    expect(r.out.bars).toBe(2);
    expect(r.fired).toEqual(['count3', 'count2']);
    // The fill bar must not retreat either, even though the car is barely
    // moving: it has gotten spatially closer, not further away.
    expect(r.out.progress).toBeGreaterThanOrEqual(progressBefore);
  });

  it('does not let the fill bar retreat when the driver lifts, and reaches full at the target', () => {
    const r = rig([1000]);
    r.approach(700, 970, 60); // down to ~0.6s, bars = 1

    const progressBeforeLift = r.out.progress;
    expect(progressBeforeLift).toBeGreaterThan(0);

    // Big lift, same place: at the old, live-speed-derived span this alone
    // collapsed the fill bar to 0% even though the car hasn't moved back.
    r.tick(972, 5);
    expect(r.out.progress).toBeGreaterThanOrEqual(progressBeforeLift);

    // Keep crawling forward at low speed all the way to the point — the bar
    // must keep filling, never disappearing before arrival.
    r.tick(985, 5);
    expect(r.out.progress).toBeGreaterThan(progressBeforeLift);
    r.tick(998, 5);
    expect(r.out.progress).toBeGreaterThan(progressBeforeLift);
    expect(r.tick(1001, 5).progress).toBe(1);
  });

  it('blanks when not driving and re-arms silently on return', () => {
    const r = rig([1000]);
    r.approach(700, 940, 60);
    expect(r.out.bars).toBeGreaterThan(0);

    r.tick(950, SPEED_MS, { driving: false });
    expect(r.out.bars).toBe(0);
    expect(r.out.tone).toBe('off');

    // Rejoining right on top of the point must not blast the brake tone.
    const before = [...r.fired];
    r.tick(980);
    r.tick(1001);
    expect(r.fired).toEqual(before);
  });

  it('resets on a teleport and on session time going backwards', () => {
    const r = rig([1000, 4000]);
    r.approach(700, 940, 60);
    expect(r.out.bars).toBeGreaterThan(0);

    r.tick(300); // towed backwards
    expect(r.out.bars).toBe(0);

    const r2 = rig([1000]);
    r2.approach(700, 940, 60);
    r2.tick(950, SPEED_MS, { sessionTime: 1 });
    expect(r2.out.bars).toBe(0);
  });

  it('does not loop the brake tone for a car stopped on a cue point', () => {
    const r = rig([1000]);
    r.approach(700, 1002, 120);
    const afterPass = r.fired.length;

    for (let i = 0; i < 50; i++) {
      r.tick(1002.5, 0.4, { sessionTime: r.sessionTime + 0.5 });
    }

    expect(r.fired.length).toBe(afterPass);
  });

  it('re-arms a point the car stopped on, so later laps still cue it', () => {
    const r = rig([1000]);
    // Pass the point, stop just beyond it, then complete the lap and come
    // round again. Nothing else is released in between, so the guard against
    // re-acquiring the point underfoot must not still be holding next time.
    for (let d = 700; d < 1000; d += 5) r.tick(d);
    for (let i = 0; i < 20; i++)
      r.tick(1002, 0, { sessionTime: r.sessionTime + 0.5 });
    for (let d = 1005; d < TRACK_LENGTH_M; d += 5) r.tick(d);
    for (let d = 0; d <= 1010; d += 5) r.tick(d);

    expect(r.fired.filter((cue) => cue === 'brake').length).toBe(2);
  });

  it('does not count down on an out lap, but never cancels mid-approach', () => {
    // Well under 60% of the reference pace at acquisition.
    const slow = rig([1000]);
    for (let d = 700; d <= 1010; d += 5) {
      slow.tick(d, 20, { referenceSpeedMs: 50 });
    }
    expect(slow.fired).toEqual([]);

    // Acquired at pace, then slowing to brake must still complete. Two ticks at
    // speed because the first only seeds the machine.
    const hot = rig([1000]);
    hot.tick(690, 50, { referenceSpeedMs: 50 });
    hot.tick(700, 50, { referenceSpeedMs: 50 });
    for (let d = 750; d <= 1010; d += 5) {
      hot.tick(d, 20, { referenceSpeedMs: 50 });
    }
    expect(hot.fired).toContain('brake');
  });

  it('tracks a target across the start/finish line', () => {
    const r = rig([50]);
    // Approaching 50m from 4850m — 200m of track, straight across the line.
    for (let d = 4850; d < 5000; d += 5) r.tick(d);
    for (let d = 0; d <= 60; d += 5) r.tick(d);

    expect(r.fired).toEqual(['count3', 'count2', 'count1', 'brake']);
  });

  it('blanks without cue points or a track length', () => {
    const state: BrakeCueLatchState = createBrakeCueLatch();
    const out = createBrakeCueOutput();
    const base = {
      carDistanceM: 500,
      speedMs: 50,
      sessionTime: 1,
      referenceSpeedMs: 0,
      driving: true,
    };

    stepBrakeCueLatch(state, out, {
      ...base,
      trackLengthM: TRACK_LENGTH_M,
      cuePointsM: new Float32Array(0),
      cuePointCount: 0,
    });
    expect(out.bars).toBe(0);

    stepBrakeCueLatch(state, out, {
      ...base,
      trackLengthM: 0,
      cuePointsM: new Float32Array([1000]),
      cuePointCount: 1,
    });
    expect(out.bars).toBe(0);
  });
});
