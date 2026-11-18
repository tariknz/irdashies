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

  describe('LMU frames over learned sector lines', () => {
    const lines = {
      SplitTimeInfo: {
        Sectors: [
          { SectorNum: 0, SectorStartPct: 0 },
          { SectorNum: 1, SectorStartPct: 0.389 },
          { SectorNum: 2, SectorStartPct: 0.791 },
        ],
      },
    } as Session;

    const lmuFrame = (
      lapDistPct: number,
      sessionTime: number,
      voided: boolean,
      isOnTrack = true
    ) =>
      ({
        ...frame(lapDistPct, sessionTime, isOnTrack),
        LmuLapInvalidated: { value: [voided] },
      }) as unknown as Telemetry;

    const start = () => {
      const processor = new SectorTimingProcessor();
      processor.init(lines);
      const state = { pct: 0.95, time: 95, voided: false };
      processor.onFrame(lmuFrame(state.pct, state.time, false));
      const to = (target: number, seconds: number) => {
        const from = state.pct;
        const begin = state.time;
        for (let step = 1; step <= 10; step += 1) {
          const pct =
            step === 10 ? target : from + ((target - from) * step) / 10;
          state.pct = pct >= 1 ? 0 : pct;
          state.time = begin + (seconds * step) / 10;
          processor.onFrame(lmuFrame(state.pct, state.time, state.voided));
        }
      };
      const lap = (s1: number, s2: number, s3: number) => {
        to(0.389, s1);
        to(0.791, s2);
        to(1, s3);
      };
      to(1, 5);
      return { processor, state, to, lap };
    };

    it('times each sector between the learned lines from the moment it began', () => {
      const { processor, to, lap } = start();
      to(0.389, 30);

      expect(processor.snapshot().currentSectorIdx).toBe(1);
      expect(processor.snapshot().sectorEntryTime).toBeCloseTo(130);

      to(0.791, 38);
      to(1, 48);
      lap(31, 39, 49);

      const times = processor.snapshot().inclusive.previousLapSectorTimes;
      expect(times[0]).toBeCloseTo(31);
      expect(times[1]).toBeCloseTo(39);
      expect(times[2]).toBeCloseTo(49);
    });

    it('keeps the fastest time in each sector, not the sectors of the best lap', () => {
      const { processor, lap } = start();
      lap(30, 38, 48);
      lap(29, 40, 46);

      const { inclusive, clean } = processor.snapshot();
      for (const bests of [
        inclusive.sessionBestSectorTimes,
        clean.sessionBestSectorTimes,
      ]) {
        expect(bests[0]).toBeCloseTo(29);
        expect(bests[1]).toBeCloseTo(38);
        expect(bests[2]).toBeCloseTo(46);
      }
    });

    it('measures a faster sector against the best it beat as soon as it ends', () => {
      const { processor, to, lap } = start();
      lap(31, 38, 48);
      lap(30, 38, 48);
      to(0.389, 29.5);

      const { inclusive } = processor.snapshot();
      expect(inclusive.sessionBestSectorTimes[0]).toBeCloseTo(29.5);
      expect(inclusive.previousSessionBestSectorTimes[0]).toBeCloseTo(30);
    });

    it('keeps S1 clean after a cut in S2 and shows the cut on the previous lap after the line', () => {
      const { processor, state, to, lap } = start();
      lap(30, 38, 48);
      to(0.389, 30);
      to(0.5, 10);
      state.voided = true;
      to(0.791, 18);

      let snapshot = processor.snapshot();
      expect(snapshot.inclusive.currentLapSectorUnclean).toEqual([
        false,
        true,
        false,
      ]);
      expect(snapshot.clean.currentLapSectorTimes[0]).toBeCloseTo(30);
      expect(snapshot.clean.currentLapSectorTimes[1]).toBeNull();

      to(1, 48);
      snapshot = processor.snapshot();
      expect(snapshot.inclusive.previousLapSectorUnclean).toEqual([
        false,
        true,
        true,
      ]);
      expect(snapshot.inclusive.sessionBestSectorTimes[1]).toBeCloseTo(28);
      expect(snapshot.clean.sessionBestSectorTimes[1]).toBeCloseTo(38);
    });

    it('does not mark the new lap from a flag still set on the crossing frame', () => {
      const { processor, state, to, lap } = start();
      lap(30, 38, 48);
      to(0.389, 30);
      to(0.791, 38);
      to(0.9, 20);
      state.voided = true;
      to(1, 28);
      to(0.03, 2);
      state.voided = false;
      to(0.389, 28);

      const { inclusive, clean } = processor.snapshot();
      expect(inclusive.previousLapSectorUnclean[2]).toBe(true);
      expect(inclusive.currentLapSectorUnclean[0]).toBe(false);
      expect(clean.currentLapSectorTimes[0]).toBeCloseTo(30);
      expect(clean.sessionBestSectorTimes[2]).toBeCloseTo(48);
    });

    it('drops the cut sector on a reset mid-lap and times the next sectors clean', () => {
      const { processor, state, to, lap } = start();
      lap(30, 38, 48);
      to(0.389, 30);
      state.voided = true;
      to(0.6, 20);
      state.voided = false;
      processor.onFrame(lmuFrame(0.1, state.time + 5, false));
      state.pct = 0.1;
      state.time += 5;
      to(0.389, 25);
      to(0.791, 36);

      const { inclusive, clean } = processor.snapshot();
      expect(inclusive.currentLapSectorTimes[0]).toBeNull();
      expect(inclusive.currentLapSectorUnclean[1]).toBe(false);
      expect(clean.currentLapSectorTimes[1]).toBeCloseTo(36);
      expect(clean.sessionBestSectorTimes[1]).toBeCloseTo(36);
    });

    it('keeps a cut sector out of the clean bests when the player leaves the car', () => {
      const { processor, state, to, lap } = start();
      lap(30, 38, 48);
      to(0.389, 30);
      to(0.791, 38);
      state.voided = true;
      to(0.9, 10);
      processor.onFrame(lmuFrame(0.9, state.time + 1, true, false));
      processor.onFrame(lmuFrame(0.9, state.time + 30, false, false));
      state.voided = false;
      state.time += 60;
      processor.onFrame(lmuFrame(0.95, state.time, false));
      state.pct = 0.95;
      to(1, 5);

      const { inclusive, clean } = processor.snapshot();
      expect(inclusive.previousLapSectorUnclean[2]).toBe(true);
      expect(clean.sessionBestSectorTimes[2]).toBeCloseTo(48);
      expect(clean.previousSessionBestSectorTimes[2]).toBeNull();
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
