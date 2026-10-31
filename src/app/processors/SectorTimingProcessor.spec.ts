import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { SectorTimingProcessor } from './SectorTimingProcessor';

const session = {
  SplitTimeInfo: {
    Sectors: [
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.5 },
    ],
  },
} as Session;

const frame = (
  lapDistPct: number,
  sessionTime: number,
  isOnTrack = true,
  sessionNum = 1
) =>
  ({
    LapDistPct: { value: [lapDistPct] },
    SessionTime: { value: [sessionTime] },
    IsOnTrack: { value: [isOnTrack] },
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

describe('SectorTimingProcessor', () => {
  it('interpolates crossings and records clean and inclusive timing views', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.4, 140));
    processor.onFrame(frame(0.6, 160));

    const snapshot = processor.snapshot();
    expect(snapshot.currentSectorIdx).toBe(1);
    expect(snapshot.inclusive.currentLapSectorTimes[0]).toBeCloseTo(50);
    expect(snapshot.clean.currentLapSectorTimes[0]).toBeCloseTo(50);
    expect(snapshot.inclusive.sessionBestSectorTimes[0]).toBeCloseTo(50);
  });

  it('keeps incident-inclusive and clean-only histories independent', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.3, 130));
    processor.onFrame(frame(0.31, 131, false));
    processor.onFrame(frame(0.4, 140));
    processor.onFrame(frame(0.6, 160));

    const snapshot = processor.snapshot();
    expect(snapshot.inclusive.currentLapSectorTimes[0]).toBeCloseTo(50);
    expect(snapshot.inclusive.currentLapSectorUnclean[0]).toBe(true);
    expect(snapshot.clean.currentLapSectorTimes[0]).toBeNull();
    expect(snapshot.clean.sessionBestSectorTimes[0]).toBeNull();
  });

  describe('LMU lap void flag', () => {
    const lmuFrame = (
      lapDistPct: number,
      sessionTime: number,
      voided: boolean
    ) =>
      ({
        ...frame(lapDistPct, sessionTime),
        LmuLapInvalidated: { value: [voided] },
      }) as unknown as Telemetry;

    it('keeps a sector voided by a track cut out of the clean bests', () => {
      // LMU voids the lap without the car leaving the track.
      const processor = new SectorTimingProcessor();
      processor.init(session);
      processor.onFrame(lmuFrame(0.9, 90, false));
      processor.onFrame(lmuFrame(0.1, 110, false));
      processor.onFrame(lmuFrame(0.3, 130, true));
      processor.onFrame(lmuFrame(0.6, 160, true));

      const snapshot = processor.snapshot();
      expect(snapshot.inclusive.currentLapSectorTimes[0]).toBeCloseTo(50);
      expect(snapshot.inclusive.currentLapSectorUnclean[0]).toBe(true);
      expect(snapshot.clean.currentLapSectorTimes[0]).toBeNull();
      expect(snapshot.clean.sessionBestSectorTimes[0]).toBeNull();
    });

    it("ignores the flag just after the line, where it is the previous lap's", () => {
      const processor = new SectorTimingProcessor();
      processor.init(session);
      processor.onFrame(lmuFrame(0.9, 90, true));
      processor.onFrame(lmuFrame(0.02, 102, true));
      processor.onFrame(lmuFrame(0.3, 130, false));
      processor.onFrame(lmuFrame(0.6, 160, false));

      const snapshot = processor.snapshot();
      expect(snapshot.inclusive.currentLapSectorUnclean[0]).toBe(false);
      expect(snapshot.clean.sessionBestSectorTimes[0]).not.toBeNull();
    });
  });

  it('resets state for session changes and disconnects', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.6, 160, true, 2));
    expect(processor.snapshot().sessionNum).toBe(2);
    expect(processor.snapshot().inclusive.sessionBestSectorTimes).toEqual([
      null,
      null,
    ]);

    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot().sectors).toEqual([]);
    expect(processor.snapshot().sessionNum).toBeNull();
  });

  it('does not aggregate replay scrubbing unless the runtime opts in', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    expect(processor.snapshot().inclusive.sessionBestSectorTimes).toEqual([
      null,
      null,
    ]);
  });

  it('does not record a sector entered from an unknown mid-lap position', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.2, 20));
    processor.onFrame(frame(0.6, 60));
    expect(processor.snapshot().inclusive.currentLapSectorTimes).toEqual([
      null,
      null,
    ]);
  });

  it('keeps the public snapshot stable between sector events', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.1, 10));
    const snapshot = processor.snapshot();

    processor.onFrame(frame(0.2, 20));
    processor.onFrame(frame(0.3, 30));

    expect(processor.snapshot()).toBe(snapshot);
    expect(processor.snapshot().version).toBe(snapshot.version);
  });

  it('invalidates active resets without discarding completed sectors', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.6, 160));
    expect(processor.snapshot().inclusive.currentLapSectorTimes[0]).toBe(50);

    processor.onFrame(frame(0.95, 161));
    expect(processor.snapshot().sectorEntryValid).toBe(false);
    expect(processor.snapshot().inclusive.currentLapSectorTimes[0]).toBe(50);
  });

  it('does not invalidate sector entry on sub-MIN_PROGRESS backward jitter', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.6, 160));
    expect(processor.snapshot().sectorEntryValid).toBe(true);

    // A sub-MIN_PROGRESS step backward — the kind of position-signal noise
    // heavy/early braking produces at near-zero ground speed. Unlike the
    // large forward jump above, this must not be mistaken for a teleport.
    processor.onFrame(frame(0.6 - 1e-6, 161));

    expect(processor.snapshot().sectorEntryValid).toBe(true);
    expect(processor.snapshot().inclusive.currentLapSectorTimes[0]).toBe(50);
  });

  it('keeps timing state when identical sector data is republished', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.onFrame(frame(0.6, 160));
    processor.init({
      SplitTimeInfo: { Sectors: [...session.SplitTimeInfo.Sectors] },
    } as Session);
    expect(processor.snapshot().inclusive.currentLapSectorTimes[0]).toBe(50);
  });

  it('resets timing when sector boundaries change', () => {
    const processor = new SectorTimingProcessor();
    processor.init(session);
    processor.onFrame(frame(0.9, 90));
    processor.onFrame(frame(0.1, 110));
    processor.init({
      SplitTimeInfo: {
        Sectors: [
          { SectorNum: 0, SectorStartPct: 0 },
          { SectorNum: 1, SectorStartPct: 0.4 },
        ],
      },
    } as Session);
    expect(processor.snapshot().inclusive.sessionBestSectorTimes).toEqual([
      null,
      null,
    ]);
    expect(processor.snapshot().sectorEntryValid).toBe(false);
  });
});
