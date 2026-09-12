import { describe, it, expect } from 'vitest';
import {
  MAX_LAP_EVENTS,
  MIN_EVENT_SPACING_M,
  PEDAL_ON_THRESHOLD,
  createPedalEventTracker,
  deriveEvents,
  interpolateCrossingM,
  nearestEventIndex,
  nextEventIndex,
  pedalEventTrackerPush,
  pedalEventTrackerSnapshot,
  recordEvent,
  resetPedalEventTracker,
  signedLapDelta,
} from './pedalEvents';
import { SampleBuffer } from './lapSamples';

describe('interpolateCrossingM', () => {
  it('lands halfway when the signal crosses halfway between samples', () => {
    // Brake goes 0 -> 0.12 between 500 m and 504 m; a 0.06 threshold is
    // crossed exactly in the middle.
    expect(interpolateCrossingM(0.06, 500, 0, 504, 0.12)).toBeCloseTo(502, 6);
  });

  it('resolves finer than the sample spacing', () => {
    // 3.33 m apart is the worst case at 300 km/h and 25 Hz.
    const m = interpolateCrossingM(0.06, 2500, 0, 2503.33, 0.3);
    // The crossing is 20% of the way through the interval -> ~0.67 m in.
    expect(m - 2500).toBeCloseTo(0.666, 2);
  });

  it('clamps to the sample window when the threshold is outside it', () => {
    expect(interpolateCrossingM(0.5, 100, 0.6, 200, 0.8)).toBe(100);
    expect(interpolateCrossingM(0.9, 100, 0.2, 200, 0.4)).toBe(200);
  });

  it('attributes a flat pair to the later sample rather than inventing one', () => {
    expect(interpolateCrossingM(0.06, 100, 0.5, 200, 0.5)).toBe(200);
  });
});

describe('recordEvent', () => {
  it('appends and reports the new count', () => {
    const positions = new Float32Array(4);
    expect(recordEvent(positions, 0, 100)).toBe(1);
    expect(positions[0]).toBe(100);
  });

  it('drops chatter closer than the spacing guard', () => {
    const positions = new Float32Array(4);
    const count = recordEvent(positions, 0, 100);
    expect(recordEvent(positions, count, 100 + MIN_EVENT_SPACING_M - 1)).toBe(
      1
    );
  });

  it('keeps a genuine second application further along', () => {
    const positions = new Float32Array(4);
    const count = recordEvent(positions, 0, 100);
    expect(recordEvent(positions, count, 100 + MIN_EVENT_SPACING_M + 1)).toBe(
      2
    );
  });

  it('refuses to write past the cap', () => {
    const positions = new Float32Array(MAX_LAP_EVENTS);
    expect(recordEvent(positions, MAX_LAP_EVENTS, 999)).toBe(MAX_LAP_EVENTS);
  });
});

describe('PedalEventTracker', () => {
  it('seeds its state from the first sample without emitting an event', () => {
    const tracker = createPedalEventTracker();
    // Every lap starts on the throttle; that must not be a throttle-on at 0 m.
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 1, 0);
    expect(tracker.throttleOnCount).toBe(0);
    expect(tracker.throttleIsOn).toBe(true);
    expect(tracker.brakeIsOn).toBe(false);
  });

  it('records brake on, off and a second on at interpolated positions', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 1, 0);
    // 0 -> 0.12 over 4 m: the 0.01 threshold is 1/12 of the way in.
    pedalEventTrackerPush(tracker, 14, 0, 0.12);
    expect(tracker.brakeOnCount).toBe(1);
    expect(tracker.brakeOnM[0]).toBeCloseTo(10 + 4 / 12, 4);

    // 0.12 -> 0 over 36 m. The application is released at a tenth of its own
    // peak (0.012), not at the bare 0.01 threshold — see
    // BRAKE_RELEASE_FRACTION — so it ends 90% of the way through.
    pedalEventTrackerPush(tracker, 50, 0, 0);
    expect(tracker.brakeOffCount).toBe(1);
    expect(tracker.brakeOffM[0]).toBeCloseTo(14 + 36 * 0.9, 4);
    expect(tracker.brakeIsOn).toBe(false);

    pedalEventTrackerPush(tracker, 60, 0, 0.5);
    expect(tracker.brakeOnCount).toBe(2);
    expect(tracker.brakeOnM[1]).toBeCloseTo(50 + 10 * 0.02, 4);
  });

  it('splits two braking zones joined by a trail-brake that never lets go', () => {
    // Imola's Variante Villeneuve: 55% for the entry, trailed down to 3%
    // between the apexes, then 39% for the second. The pedal never reaches the
    // 1% release, so judged on that alone this is one 160 m application and the
    // second half of the chicane has no brake point of its own.
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 0, 0);
    pedalEventTrackerPush(tracker, 10, 0, 0.55);
    pedalEventTrackerPush(tracker, 100, 0, 0.03);
    pedalEventTrackerPush(tracker, 120, 0, 0.39);

    expect(tracker.brakeOnCount).toBe(2);
    expect(tracker.brakeOffCount).toBe(1);
  });

  it('keeps a trail-brake above a tenth of its peak as one application', () => {
    // 8% of a 55% zone is still braking for the same corner, not a new one.
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 0, 0);
    pedalEventTrackerPush(tracker, 10, 0, 0.55);
    pedalEventTrackerPush(tracker, 100, 0, 0.08);
    pedalEventTrackerPush(tracker, 120, 0, 0.3);

    expect(tracker.brakeOnCount).toBe(1);
    expect(tracker.brakeOffCount).toBe(0);
  });

  it('does not re-apply on the pressure that just counted as a release', () => {
    // The pedal is still pressed after a peak-relative release, so re-arming at
    // the bare 1% threshold would fire again on the very next sample.
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 0, 0);
    pedalEventTrackerPush(tracker, 10, 0, 0.55);
    pedalEventTrackerPush(tracker, 100, 0, 0.03);
    expect(tracker.brakeOffCount).toBe(1);

    pedalEventTrackerPush(tracker, 110, 0, 0.035);
    pedalEventTrackerPush(tracker, 120, 0, 0.04);

    expect(tracker.brakeOnCount).toBe(1);
  });

  it('records a throttle application after a lift', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 100, 0, 1);
    expect(tracker.throttleIsOn).toBe(false);
    pedalEventTrackerPush(tracker, 150, 0, 1);
    pedalEventTrackerPush(tracker, 152, 0.5, 0);
    expect(tracker.throttleOnCount).toBe(1);
    expect(tracker.throttleOnM[0]).toBeCloseTo(150 + 2 * 0.02, 4);
  });

  it('does not re-trigger while the pedal stays applied', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 0, 0.5);
    pedalEventTrackerPush(tracker, 15, 0, 0.9);
    pedalEventTrackerPush(tracker, 20, 0, 0.4);
    expect(tracker.brakeOnCount).toBe(1);
  });

  it('ignores pedal noise below the on-threshold', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 1, PEDAL_ON_THRESHOLD / 2);
    pedalEventTrackerPush(tracker, 20, 1, PEDAL_ON_THRESHOLD * 0.8);
    expect(tracker.brakeOnCount).toBe(0);
  });

  it('drops a re-application inside the chatter guard', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 99, 1, 0);
    // On at ~99, off at ~101, on again at ~101 — 2 m after the first on.
    pedalEventTrackerPush(tracker, 100, 0, 1);
    pedalEventTrackerPush(tracker, 101, 0, 0);
    pedalEventTrackerPush(tracker, 102, 0, 1);
    expect(tracker.brakeOnCount).toBe(1);
    expect(tracker.brakeOffCount).toBe(1);
  });

  it('caps each list at MAX_LAP_EVENTS', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    for (let i = 0; i < MAX_LAP_EVENTS + 10; i++) {
      pedalEventTrackerPush(tracker, 10 + i * 20, 0, 1);
      pedalEventTrackerPush(tracker, 20 + i * 20, 0, 0);
    }
    expect(tracker.brakeOnCount).toBe(MAX_LAP_EVENTS);
    expect(tracker.brakeOffCount).toBe(MAX_LAP_EVENTS);
  });

  it('resets in place for the next lap', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 0, 1);
    expect(tracker.brakeOnCount).toBe(1);
    resetPedalEventTracker(tracker);
    expect(tracker.brakeOnCount).toBe(0);
    expect(tracker.started).toBe(false);
    // Seeds again rather than treating the first sample as a crossing.
    pedalEventTrackerPush(tracker, 0, 0, 1);
    expect(tracker.brakeOnCount).toBe(0);
    expect(tracker.brakeIsOn).toBe(true);
  });

  it('snapshots exact-length copies', () => {
    const tracker = createPedalEventTracker();
    pedalEventTrackerPush(tracker, 0, 1, 0);
    pedalEventTrackerPush(tracker, 10, 0, 1);
    const events = pedalEventTrackerSnapshot(tracker);
    expect(events.brakeOnM.length).toBe(1);
    expect(events.brakeOffM.length).toBe(0);
    expect(events.throttleOnM.length).toBe(0);
    resetPedalEventTracker(tracker);
    pedalEventTrackerPush(tracker, 0, 0, 0);
    pedalEventTrackerPush(tracker, 500, 0, 1);
    expect(events.brakeOnM[0]).toBeCloseTo(0.1, 4);
  });
});

describe('deriveEvents', () => {
  it('produces exactly what the live tracker would from the same stream', () => {
    const buffer = new SampleBuffer(64);
    const live = createPedalEventTracker();
    for (let i = 0; i < 60; i++) {
      const d = i * 7.3;
      const brake = i % 12 < 4 ? 0.8 : 0;
      const throttle = brake > 0 ? 0 : 1;
      buffer.push(d, i * 0.1, throttle, brake, 40, 3, 0);
      // The recorder feeds the tracker the value the buffer stored (Float32),
      // not the raw double — that is what makes the two paths identical.
      pedalEventTrackerPush(
        live,
        buffer.distanceM[buffer.length - 1],
        throttle,
        brake
      );
    }

    const derived = deriveEvents(buffer);
    const expected = pedalEventTrackerSnapshot(live);
    expect(Array.from(derived.brakeOnM)).toEqual(Array.from(expected.brakeOnM));
    expect(Array.from(derived.brakeOffM)).toEqual(
      Array.from(expected.brakeOffM)
    );
    expect(Array.from(derived.throttleOnM)).toEqual(
      Array.from(expected.throttleOnM)
    );
    expect(derived.brakeOnM.length).toBeGreaterThan(1);
  });

  it('returns empty lists for an empty lap', () => {
    const events = deriveEvents(new SampleBuffer(2));
    expect(events.brakeOnM.length).toBe(0);
    expect(events.throttleOnM.length).toBe(0);
  });
});

describe('signedLapDelta', () => {
  it('is positive when the target is ahead', () => {
    expect(signedLapDelta(100, 130, 5000)).toBe(30);
  });

  it('is negative when the target is behind', () => {
    expect(signedLapDelta(130, 100, 5000)).toBe(-30);
  });

  it('takes the short way around the start/finish line', () => {
    expect(signedLapDelta(4990, 10, 5000)).toBe(20);
    expect(signedLapDelta(10, 4990, 5000)).toBe(-20);
  });
});

describe('nearestEventIndex', () => {
  const positions = Float32Array.from([100, 800, 2400, 4990]);

  it('finds the closest event', () => {
    expect(nearestEventIndex(positions, 4, 810, 5000, 100)).toBe(1);
  });

  it('returns -1 when nothing is within range', () => {
    expect(nearestEventIndex(positions, 4, 1500, 5000, 100)).toBe(-1);
  });

  it('pairs across the start/finish line', () => {
    expect(nearestEventIndex(positions, 4, 20, 5000, 60)).toBe(3);
  });

  it('respects the count bound over the buffer length', () => {
    // Only the first two entries are populated in this lap so far.
    expect(nearestEventIndex(positions, 2, 2400, 5000, 100)).toBe(-1);
  });
});

describe('nextEventIndex', () => {
  const positions = Float32Array.from([100, 800, 2400, 4990]);

  it('finds the closest event strictly ahead', () => {
    expect(nextEventIndex(positions, 4, 700, 5000, 200)).toBe(1);
  });

  it('ignores an event behind the target', () => {
    expect(nextEventIndex(positions, 4, 850, 5000, 200)).not.toBe(1);
  });

  it('returns -1 when nothing ahead is within range', () => {
    expect(nextEventIndex(positions, 4, 900, 5000, 100)).toBe(-1);
  });

  it('wraps across the start/finish line', () => {
    // Nothing ahead of 4995 until the lap wraps back to 100 (105 m on).
    expect(nextEventIndex(positions, 4, 4995, 5000, 200)).toBe(0);
  });

  it('respects the count bound over the buffer length', () => {
    expect(nextEventIndex(positions, 2, 700, 5000, 2000)).toBe(1);
    expect(nextEventIndex(positions, 1, 700, 5000, 2000)).toBe(-1);
  });
});
