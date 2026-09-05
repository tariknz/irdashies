import { describe, it, expect, beforeEach } from 'vitest';
import { CarSystemsProcessor } from './CarSystemsProcessor';
import type { Session, Telemetry } from '@irdashies/types';

/**
 * Frames are built the way the SDK publishes them: a variable that the car does
 * not expose is absent from the frame entirely, not present-and-null.
 */
const frame = (
  values: Record<string, number | boolean | undefined>,
  { inCar = true }: { inCar?: boolean } = {}
): Telemetry => {
  const out: Record<string, { value: unknown[] }> = {
    SessionNum: { value: [0] },
    IsOnTrack: { value: [inCar] },
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    out[key] = { value: [value] };
  }
  return out as unknown as Telemetry;
};

const start = () => {
  const processor = new CarSystemsProcessor();
  processor.init({} as Session);
  processor.onLifecycle({ type: 'enter', replay: false });
  return processor;
};

const byKey = (processor: CarSystemsProcessor, key: string) =>
  processor.snapshot().adjustments.find((a) => a.key === key);

describe('CarSystemsProcessor', () => {
  let processor: CarSystemsProcessor;

  beforeEach(() => {
    processor = start();
  });

  describe('discovery', () => {
    it('reports only the adjustments the car actually exposes', () => {
      // A Formula Vee exposes brake bias and nothing else.
      processor.onFrame(frame({ dcBrakeBias: 48 }));

      expect(processor.snapshot().adjustments.map((a) => a.label)).toEqual([
        'Brake Bias',
      ]);
    });

    it('reports the fuller set a GT3 car exposes', () => {
      processor.onFrame(
        frame({
          dcBrakeBias: 54.5,
          dcABS: 2,
          dcTractionControl: 3,
          dcThrottleShape: 1,
        })
      );

      // The snapshot carries the full label; the widget renders the short form
      // from the shared catalogue, so this is the settings-facing name.
      expect(processor.snapshot().adjustments.map((a) => a.label)).toEqual([
        'Brake Bias',
        'ABS',
        'Traction Control',
        'Throttle Shape',
      ]);
    });

    it('ignores momentary controls that are not settings', () => {
      // dcTractionControlToggle reads false continuously on cars whose traction
      // control is plainly on, so it is not an on/off state and must not appear.
      processor.onFrame(
        frame({
          dcBrakeBias: 50,
          dcTractionControl: 4,
          dcTractionControlToggle: false,
          dcStarter: false,
          dcPitSpeedLimiterToggle: false,
          dcHeadlightFlash: false,
        })
      );

      expect(processor.snapshot().adjustments.map((a) => a.key)).toEqual([
        'dcBrakeBias',
        'dcTractionControl',
      ]);
    });

    it('takes the Clio brake bias variable when that is the one published', () => {
      processor.onFrame(frame({ dcPeakBrakeBias: 61 }));

      const rows = processor.snapshot().adjustments;
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe('Brake Bias');
      expect(rows[0].value).toBe(61);
    });

    it('does not discover anything from an out-of-car frame', () => {
      // Spectating publishes a reduced set, so nothing seen out of the car can
      // be trusted to describe it. The frame carries real adjustments here on
      // purpose: discovery must be refused because of where it came from, not
      // because there was nothing in it.
      processor.onFrame(frame({ dcBrakeBias: 50, dcABS: 2 }, { inCar: false }));

      expect(processor.snapshot().discovered).toBe(false);
      expect(processor.snapshot().adjustments).toEqual([]);
    });

    it('picks up a variable that starts publishing a frame later', () => {
      processor.onFrame(frame({ dcBrakeBias: 50 }));
      processor.onFrame(frame({ dcBrakeBias: 50, dcABS: 3 }));

      expect(processor.snapshot().adjustments.map((a) => a.key)).toEqual([
        'dcBrakeBias',
        'dcABS',
      ]);
    });

    it('keeps a row whose variable stops appearing in later in-car frames', () => {
      processor.onFrame(frame({ dcBrakeBias: 50, dcABS: 3 }));
      // Still in the car, but ABS is missing from this frame. Dropping the row
      // would make the table flicker as rows come and go.
      processor.onFrame(frame({ dcBrakeBias: 50 }));

      expect(processor.snapshot().adjustments.map((a) => a.key)).toEqual([
        'dcBrakeBias',
        'dcABS',
      ]);
    });

    it('excludes a momentary control even when it reports a number', () => {
      // dcDashPage is a page index, not a setting to read back. Excluding it
      // has to be a decision about what belongs, not a side effect of the
      // boolean controls happening to fail a numeric check.
      processor.onFrame(
        frame({ dcBrakeBias: 50, dcDashPage: 2, dcDashPage2: 1 })
      );

      expect(processor.snapshot().adjustments.map((a) => a.key)).toEqual([
        'dcBrakeBias',
      ]);
    });
  });

  describe('leaving the car', () => {
    it('keeps the last known values rather than emptying the table', () => {
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));
      processor.onFrame(frame({ dcStarter: false }, { inCar: false }));

      const rows = processor.snapshot().adjustments;
      expect(rows.map((a) => a.key)).toEqual(['dcBrakeBias', 'dcABS']);
      expect(byKey(processor, 'dcABS')?.value).toBe(2);
    });
  });

  describe('off detection', () => {
    it('marks a zero as off on an unsigned scale', () => {
      // A BMW M2 Racing sits at 0 for both when the driver switches them off.
      processor.onFrame(frame({ dcABS: 0, dcTractionControl: 0 }));

      expect(byKey(processor, 'dcABS')?.isOff).toBe(true);
      expect(byKey(processor, 'dcTractionControl')?.isOff).toBe(true);
    });

    it('does not mark a non-zero setting as off', () => {
      processor.onFrame(frame({ dcABS: 1, dcTractionControl: 3 }));

      expect(byKey(processor, 'dcABS')?.isOff).toBe(false);
      expect(byKey(processor, 'dcTractionControl')?.isOff).toBe(false);
    });

    it('does not treat zero as off once the scale is known to be signed', () => {
      // The BMW M Hybrid V8 reports ABS between -5 and -3, so zero on that
      // scale is an ordinary setting rather than the system being off.
      processor.onFrame(frame({ dcABS: -5 }));
      processor.onFrame(frame({ dcABS: 0 }));

      expect(byKey(processor, 'dcABS')?.isOff).toBe(false);
    });

    it('judges the scale of each variable independently', () => {
      processor.onFrame(frame({ dcABS: -3, dcTractionControl: 2 }));
      processor.onFrame(frame({ dcABS: 0, dcTractionControl: 0 }));

      expect(byKey(processor, 'dcABS')?.isOff).toBe(false);
      expect(byKey(processor, 'dcTractionControl')?.isOff).toBe(true);
    });
  });

  describe('publishing', () => {
    it('does not bump the version when nothing changed', () => {
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));
      const version = processor.snapshot().version;

      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));

      expect(processor.snapshot().version).toBe(version);
    });

    it('bumps the version when the driver turns a dial', () => {
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));
      const version = processor.snapshot().version;

      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 3 }));

      expect(processor.snapshot().version).toBeGreaterThan(version);
      expect(byKey(processor, 'dcABS')?.value).toBe(3);
    });
  });

  describe('lifecycle', () => {
    it('records nothing during a replay', () => {
      const replaying = new CarSystemsProcessor();
      replaying.init({} as Session);
      replaying.onLifecycle({ type: 'enter', replay: true });

      replaying.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));

      expect(replaying.snapshot().adjustments).toEqual([]);
      expect(replaying.snapshot().discovered).toBe(false);
    });

    it('forgets the car when the session changes', () => {
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));

      processor.onLifecycle({ type: 'sessionNumChange' });

      expect(processor.snapshot().adjustments).toEqual([]);
      expect(processor.snapshot().discovered).toBe(false);
    });

    it('forgets the car on disconnect, so the next one starts clean', () => {
      processor.onFrame(frame({ dcBrakeBias: 54, dcABS: 2 }));

      processor.onLifecycle({ type: 'disconnect' });

      expect(processor.snapshot().discovered).toBe(false);
    });
  });
});
