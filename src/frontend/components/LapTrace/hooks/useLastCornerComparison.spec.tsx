import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ChannelBridge,
  LapTraceSampleSnapshot,
  LovelyTrackSection,
} from '@irdashies/types';
import { useLapTraceStore } from '@irdashies/context';
import { hydrateLapTrace } from '../../../domain/lapTrace/hydrateLapTrace';
import { makeSyntheticLapTrace } from '../fixtures/syntheticLap';
import {
  MAX_LAST_CORNER_HISTORY,
  useLastCornerComparison,
  useLastCornerLabels,
} from './useLastCornerComparison';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSections = vi.fn<() => LovelyTrackSection[]>(() => []);
vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useLovelyTrackData: () => ({ sections: mockSections(), info: null }),
  };
});

const TRACK_LENGTH_M = 5000;
const TRACK_ID = 7;
const CAR_PATH = 'testcar';
const REFERENCE_SPEED_MS = 20;
/** One simulated frame's worth of lap, matching the 60 Hz sample channel. */
const FRAME_PCT = 0.0005;

const corner = (
  overrides: Partial<LovelyTrackSection> = {}
): LovelyTrackSection =>
  ({
    section_id: 'turn-1',
    name: 'Turn 1',
    corner_number: 'T1',
    type: 'corner',
    start_pct: 0.2,
    end_pct: 0.25,
    length_pct: 0.05,
    ...overrides,
  }) as LovelyTrackSection;

let deliverSample: (sample: LapTraceSampleSnapshot) => void;
let unsubscribe: ReturnType<typeof vi.fn>;
let subscribedChannels: string[];

/**
 * A reference lap at one flat speed: every sample's clock is then exactly
 * distance / speed, so a corner's reference time is known in closed form.
 */
const flatReference = (speedMs: number) => {
  const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
  const { samples } = record;
  samples.speed.fill(speedMs);
  for (let i = 0; i < samples.length; i++) {
    samples.timeSec[i] = samples.distanceM[i] / speedMs;
  }
  return record;
};

const seedReference = (speedMs = REFERENCE_SPEED_MS) => {
  useLapTraceStore.setState({
    referenceLap: hydrateLapTrace(flatReference(speedMs)),
  });
};

/** Length of the braking zone carved into the reference for each brake point. */
const BRAKE_ZONE_M = 50;

/**
 * A reference lap with controlled brake points. Each one gets a real braking
 * zone — a release 50 m later and speed scrubbed off in between — because
 * attribution only considers points that actually shed speed, exactly as the
 * audible countdown does. A brake-on event with no speed drop behind it is a
 * stabilising dab or pedal noise, and is deliberately not a corner's brake
 * point.
 */
const seedReferenceWithBrakeEvents = (referenceBrakeOnM: number[]) => {
  const record = flatReference(REFERENCE_SPEED_MS);
  const { samples } = record;
  for (const brakeM of referenceBrakeOnM) {
    for (let i = 0; i < samples.length; i++) {
      const d = samples.distanceM[i];
      if (d > brakeM && d <= brakeM + BRAKE_ZONE_M) {
        samples.speed[i] = REFERENCE_SPEED_MS - 8;
      }
    }
  }
  useLapTraceStore.setState({
    referenceLap: {
      ...hydrateLapTrace(record),
      // Events are derived on hydrate, so they are overridden on the view.
      events: {
        brakeOnM: Float32Array.from(referenceBrakeOnM),
        brakeOffM: Float32Array.from(
          referenceBrakeOnM.map((m) => m + BRAKE_ZONE_M)
        ),
        throttleOnM: new Float32Array(),
      },
    },
  });
};

const seedReferenceWithBrakeEvent = (referenceBrakeOnM: number) =>
  seedReferenceWithBrakeEvents([referenceBrakeOnM]);

/**
 * One braking zone with an explicit release, for the cases that turn on where
 * the brake was let go rather than only where it came on.
 */
const seedReferenceWithBrakeZone = (brakeOnM: number, brakeOffM: number) => {
  const record = flatReference(REFERENCE_SPEED_MS);
  const { samples } = record;
  for (let i = 0; i < samples.length; i++) {
    const d = samples.distanceM[i];
    if (d > brakeOnM && d <= brakeOffM) {
      samples.speed[i] = REFERENCE_SPEED_MS - 8;
    }
  }
  useLapTraceStore.setState({
    referenceLap: {
      ...hydrateLapTrace(record),
      events: {
        brakeOnM: Float32Array.from([brakeOnM]),
        brakeOffM: Float32Array.from([brakeOffM]),
        throttleOnM: new Float32Array(),
      },
    },
  });
};

/** Directly sets the driven lap's brake point, bypassing telemetry playback. */
const setLiveBrakeOn = (metres: number) => {
  const activeLap = useLapTraceStore.getState().activeLap;
  if (!activeLap) throw new Error('activeLap not initialised');
  activeLap.events.brakeOnM[0] = metres;
  activeLap.events.brakeOnCount = 1;
};

let sampleVersion = 0;
let frameTime = 0;

const sampleAt = (
  pct: number,
  speedMs: number,
  overrides: Partial<LapTraceSampleSnapshot> = {}
): LapTraceSampleSnapshot => ({
  sessionTime: frameTime,
  lapDistPct: pct,
  throttle: 1,
  brake: 0,
  speed: speedMs,
  gear: 4,
  brakeAbsActive: false,
  onPitRoad: false,
  isOnTrack: true,
  sessionNum: 0,
  lastLapTime: 0,
  lapCompleted: 0,
  incidentCount: 0,
  version: ++sampleVersion,
  ...overrides,
});

/** Record a frame into the lap buffer without delivering it to the hook. */
const recordOnly = (sample: LapTraceSampleSnapshot) => {
  useLapTraceStore.getState().collectPlayerFrame(undefined, sample);
};

/** Deliver a frame to the hook without recording it into the lap buffer. */
const deliverOnly = (sample: LapTraceSampleSnapshot) =>
  act(() => {
    deliverSample(sample);
  });

/**
 * One simulated frame, in the order the sim produces it: the recorder stores
 * the sample, then the hook sees the same frame. Both come off `lap-trace.sample`.
 */
const frame = (
  pct: number,
  speedMs = 18,
  stepPct = FRAME_PCT,
  overrides: Partial<LapTraceSampleSnapshot> = {}
) => {
  frameTime += (stepPct * TRACK_LENGTH_M) / speedMs;
  const sample = sampleAt(pct, speedMs, overrides);
  recordOnly(sample);
  deliverOnly(sample);
  return sample;
};

/** Drive from one point on the lap to another, one frame at a time. */
const drive = (
  fromPct: number,
  toPct: number,
  speedMs = 18,
  stepPct = FRAME_PCT
) => {
  for (let pct = fromPct; pct <= toPct + 1e-9; pct += stepPct) {
    frame(pct, speedMs, stepPct);
  }
};

describe('useLastCornerComparison', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSections.mockReturnValue([corner()]);
    frameTime = 0;

    let callback: ((payload: unknown) => void) | undefined;
    subscribedChannels = [];
    unsubscribe = vi.fn(() => {
      callback = undefined;
    });
    const subscribe = vi.fn(
      (channel: string, cb: (payload: unknown) => void) => {
        subscribedChannels.push(channel);
        if (channel === 'lap-trace.sample') callback = cb;
        return unsubscribe;
      }
    );
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    deliverSample = (sample) => callback?.(sample);

    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(undefined, TRACK_ID, '', CAR_PATH, TRACK_LENGTH_M);
    seedReference();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;
    useLapTraceStore.getState().reset();
  });

  it('reports the corner only once it has been driven through', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.22);
    // Still inside the corner: nothing is published until it is finished.
    expect(result.current).toHaveLength(0);

    drive(0.2205, 0.26);

    expect(result.current[0]?.label).toBe('T1');
    // Slower than the 20 m/s reference, so it cost time and lost apex speed.
    expect(result.current[0]?.timeDeltaSec).toBeGreaterThan(0);
    expect(result.current[0]?.apexSpeedDeltaMs).toBeLessThan(0);
  });

  it('reports a gain when the driver was quicker through the corner', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26, 22);

    expect(result.current[0]?.timeDeltaSec).toBeLessThan(0);
    expect(result.current[0]?.apexSpeedDeltaMs).toBeGreaterThan(0);
  });

  it('keeps a sequence of corners readable instead of replacing each one', () => {
    // The regression this history exists for: corners close enough together
    // that a single-result panel flashed each one away before it could be read.
    mockSections.mockReturnValue([
      corner(),
      corner({
        section_id: 'turn-2',
        corner_number: 'T2',
        start_pct: 0.27,
        end_pct: 0.3,
      }),
      corner({
        section_id: 'turn-3',
        corner_number: 'T3',
        start_pct: 0.32,
        end_pct: 0.35,
      }),
    ]);
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.4);

    expect(result.current.map((e) => e.sectionId)).toEqual([
      'turn-3',
      'turn-2',
      'turn-1',
    ]);
  });

  it('keeps the previous corner on screen until the current one finishes', () => {
    mockSections.mockReturnValue([
      corner(),
      corner({
        section_id: 'turn-2',
        corner_number: 'T2',
        start_pct: 0.5,
        end_pct: 0.55,
      }),
    ]);
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26);
    expect(result.current[0]?.sectionId).toBe('turn-1');

    // Holds all the way down the straight...
    drive(0.2605, 0.49);
    expect(result.current[0]?.sectionId).toBe('turn-1');

    // ...and through turn-2 itself, right up until it is finished.
    drive(0.4905, 0.54);
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.sectionId).toBe('turn-1');

    drive(0.5405, 0.56);
    expect(result.current.map((e) => e.sectionId)).toEqual([
      'turn-2',
      'turn-1',
    ]);
  });

  it('caps how much history it keeps', () => {
    mockSections.mockReturnValue(
      Array.from({ length: MAX_LAST_CORNER_HISTORY + 2 }, (_, i) =>
        corner({
          section_id: `turn-${i + 1}`,
          corner_number: `T${i + 1}`,
          start_pct: 0.1 + i * 0.05,
          end_pct: 0.13 + i * 0.05,
        })
      )
    );
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.05, 0.62);

    expect(result.current.length).toBe(MAX_LAST_CORNER_HISTORY);
  });

  it('keeps the history across the start/finish line', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26);
    expect(result.current[0]?.sectionId).toBe('turn-1');

    // Round to the line and over it. The corners just driven are still what
    // the driver wants to read on the main straight, so history survives.
    drive(0.2605, 0.999);
    drive(0, 0.06);

    expect(result.current[0]?.sectionId).toBe('turn-1');
  });

  it('does not re-report a corner on the next lap until it is driven again', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26);
    expect(result.current).toHaveLength(1);

    // Over the line and down to just before the corner: still one entry.
    drive(0.2605, 0.999);
    drive(0, 0.19);
    expect(result.current).toHaveLength(1);

    // Driven again, it is reported again.
    drive(0.1905, 0.26);
    expect(result.current).toHaveLength(2);
    expect(result.current.map((e) => e.sectionId)).toEqual([
      'turn-1',
      'turn-1',
    ]);
  });

  it('never adds an entry when the comparison cannot be trusted', () => {
    // The tick is delivered without the frames ever being recorded, so the lap
    // has no samples for the corner — no entry at all, not a blank row.
    const { result } = renderHook(() => useLastCornerComparison(true));

    for (let pct = 0.1; pct <= 0.26; pct += 0.01) {
      frameTime += 1;
      deliverOnly(sampleAt(pct, 18));
    }

    expect(result.current).toEqual([]);
  });

  it('does not re-render while the results are held', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLastCornerComparison(true);
    });

    drive(0.1, 0.26);
    expect(result.current[0]?.timeDeltaSec).not.toBeNull();

    // This is the R2.3 contract: holding the results down the following straight
    // must cost nothing. Frames arrive at telemetry rate; renders must not.
    const rendersAfterCommit = renders;
    drive(0.2605, 0.3);

    expect(renders).toBe(rendersAfterCommit);
    expect(result.current[0]?.timeDeltaSec).not.toBeNull();
  });

  it('does not re-render while parked off track', () => {
    // An empty history has no identity shortcut the way a null result had, so
    // clearing must no-op once already empty — otherwise sitting in the pits
    // would re-render the widget at telemetry rate.
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLastCornerComparison(true);
    });

    deliverOnly(sampleAt(0.3, 0, { onPitRoad: true }));
    const settled = renders;

    for (let i = 0; i < 50; i++) {
      frameTime += 1;
      deliverOnly(sampleAt(0.3, 0, { onPitRoad: true }));
    }

    expect(renders).toBe(settled);
    expect(result.current).toEqual([]);
  });

  it('clears while off track, in the pits, or watching a replay', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26);
    expect(result.current.length).toBeGreaterThan(0);

    deliverOnly(sampleAt(0.3, 18, { onPitRoad: true }));
    expect(result.current).toEqual([]);
  });

  it('skips a corner the driver was already inside when the lap began', () => {
    const { result } = renderHook(() => useLastCornerComparison(true));

    // Recording starts mid-corner, so its entry was never observed and the
    // comparison would be against a partial lap.
    drive(0.22, 0.26);

    expect(result.current).toEqual([]);
  });

  it('stays empty without a reference lap to compare against', () => {
    useLapTraceStore.setState({ referenceLap: null });
    const { result } = renderHook(() => useLastCornerComparison(true));

    drive(0.1, 0.26);

    expect(result.current).toEqual([]);
  });

  it('never subscribes without track data for the circuit', () => {
    mockSections.mockReturnValue([]);
    renderHook(() => useLastCornerComparison(true));

    expect(subscribedChannels).not.toContain('lap-trace.sample');
  });

  it('never subscribes when disabled', () => {
    renderHook(() => useLastCornerComparison(false));

    expect(subscribedChannels).toEqual([]);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useLastCornerComparison(true));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  describe('reporting a corner off the recorded lap', () => {
    it('still reports a corner whose tick arrives before its own sample', () => {
      // The bug this design exists for. Track state used to drive the machine
      // at 25 Hz while the buffer was filled at 60 Hz from another channel, so
      // roughly 42% of exits were evaluated one frame before the sample they
      // needed had arrived, and the corner vanished with no trace. Here the
      // frame that clears the corner's end is delivered before it is recorded.
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.2495);
      expect(result.current).toHaveLength(0);

      // Position past the corner end, but the buffer has not got it yet.
      frameTime += 0.1;
      const exit = sampleAt(0.2505, 18);
      deliverOnly(exit);
      expect(result.current).toHaveLength(0);

      // The very next frame carries it, and the corner is reported.
      recordOnly(exit);
      frame(0.251, 18);

      expect(result.current.map((e) => e.sectionId)).toEqual(['turn-1']);
      expect(result.current[0]?.timeDeltaSec).not.toBeNull();
    });

    it('reports corners driven at a crawl', () => {
      // The other way corners used to be lost: movement under a minimum-
      // progress threshold skipped the crossing checks entirely while still
      // advancing the anchor, so a car creeping through a corner passed its
      // boundaries untested and stranded the machine for the rest of the lap.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.3,
          end_pct: 0.35,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      // 0.00002 of a lap per frame is 0.1 m of movement — far under the old
      // threshold, which skipped the crossing checks entirely at that step.
      drive(0.19, 0.26, 16, 0.00002);
      expect(result.current.map((e) => e.sectionId)).toEqual(['turn-1']);

      // And the corner after it still records on the same lap.
      drive(0.2605, 0.36, 18);
      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-2',
        'turn-1',
      ]);
    });

    it('skips only the corners a tow spans, and keeps recording after it', () => {
      // A tow leaves a hole in the buffer wider than a corner can be trusted
      // across. That corner is skipped; the rest of the lap is not lost.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.5,
          end_pct: 0.55,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      // Straight past turn-1 with no samples in between, then drive normally.
      drive(0.1, 0.19);
      drive(0.26, 0.56);

      expect(result.current.map((e) => e.sectionId)).toEqual(['turn-2']);
    });
  });

  describe('active reset', () => {
    /**
     * iRacing's Active Reset teleports the car back to a saved point with the
     * speed it had when the point was set. It is a single frame's worth of
     * time covering half a lap, which the recorder reads as a jump and
     * restarts the lap on — bumping lapSerial, which is what re-arms this hook.
     */
    const activeResetTo = (pct: number) => frame(pct, 18);

    it('reports the corner again on every attempt', () => {
      // The whole point of Active Reset: practise one corner over and over.
      // Each attempt is its own row, so they can be read against each other.
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.26);
      expect(result.current.map((e) => e.sectionId)).toEqual(['turn-1']);

      activeResetTo(0.15);
      drive(0.1505, 0.26);

      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-1',
        'turn-1',
      ]);
    });

    it('keeps the corners already on screen', () => {
      // They were really driven, so a reset is no reason to blank them.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.3,
          end_pct: 0.35,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.36);
      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-2',
        'turn-1',
      ]);

      activeResetTo(0.15);
      drive(0.1505, 0.19);

      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-2',
        'turn-1',
      ]);
    });

    it('never reports the corner the reset interrupted', () => {
      const { result } = renderHook(() => useLastCornerComparison(true));

      // Reset from inside turn-1, back to before it.
      drive(0.1, 0.22);
      activeResetTo(0.15);
      drive(0.1505, 0.19);
      expect(result.current).toHaveLength(0);

      // Only the attempt actually driven through counts, and only once.
      drive(0.1905, 0.26);
      expect(result.current).toHaveLength(1);
    });

    it('skips a corner the reset dropped the car inside', () => {
      // Landing mid-corner is the same problem as joining a lap mid-corner:
      // its entry was never observed, so there is nothing to compare.
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      activeResetTo(0.22);
      drive(0.2205, 0.26);

      expect(result.current).toEqual([]);
    });
  });

  describe('split complexes', () => {
    /**
     * Imola's Acque Minerali, as the bundled track data models it: one named
     * corner in two abutting halves, sharing a name and a section_id. A spans
     * 1000-1250 m, B 1250-1400 m.
     */
    const splitPair = () => [
      corner({
        section_id: 'acque_minerali',
        name: 'Acque Minerali',
        corner_number: undefined,
        start_pct: 0.2,
        end_pct: 0.25,
      }),
      corner({
        section_id: 'acque_minerali',
        name: 'Acque Minerali',
        corner_number: undefined,
        start_pct: 0.25,
        end_pct: 0.28,
      }),
    ];

    it('letters the halves apart instead of listing one name twice', () => {
      mockSections.mockReturnValue(splitPair());
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.29);

      expect(result.current.map((e) => e.label)).toEqual([
        'Acque Minerali B',
        'Acque Minerali A',
      ]);
      // The id is a row's identity, so the halves must not share one either.
      expect(result.current.map((e) => e.sectionId)).toEqual([
        'acque_minerali_b',
        'acque_minerali_a',
      ]);
    });

    it('leaves a corner that stands alone unsuffixed', () => {
      mockSections.mockReturnValue([
        corner({ section_id: 'tosa', name: 'Tosa', corner_number: undefined }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.26);

      expect(result.current[0]?.label).toBe('Tosa');
      expect(result.current[0]?.sectionId).toBe('tosa');
    });

    it('does not letter two corners that merely share a name', () => {
      // A long circuit can use one name twice for genuinely separate corners.
      // Only a run of adjacent sections is one complex.
      mockSections.mockReturnValue([
        corner({
          section_id: 'karussell',
          name: 'Karussell',
          corner_number: undefined,
          start_pct: 0.2,
          end_pct: 0.25,
        }),
        corner({
          section_id: 'wippermann',
          name: 'Wippermann',
          corner_number: undefined,
          start_pct: 0.3,
          end_pct: 0.35,
        }),
        corner({
          section_id: 'karussell',
          name: 'Karussell',
          corner_number: undefined,
          start_pct: 0.4,
          end_pct: 0.45,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.46);

      expect(result.current.map((e) => e.label)).toEqual([
        'Karussell',
        'Wippermann',
        'Karussell',
      ]);
    });

    it('reports one continuous braking event against the half it began in', () => {
      // The reference brakes once for the complex, from 1100 m — inside A —
      // and is still braking at 1250 where B begins. Reporting that against B
      // would credit the second half with braking that happened in the first.
      mockSections.mockReturnValue(splitPair());
      seedReferenceWithBrakeZone(1100, 1300);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(1105);
      drive(0.1905, 0.29);

      const a = result.current.find((e) => e.sectionId === 'acque_minerali_a');
      const b = result.current.find((e) => e.sectionId === 'acque_minerali_b');
      expect(a?.brakePointDeltaM).toBe(5);
      expect(b?.brakePointDeltaM).toBeNull();
      // Both halves are still listed with their own time and apex speed.
      expect(a?.timeDeltaSec).not.toBeNull();
      expect(b?.timeDeltaSec).not.toBeNull();
    });

    it('labels corners by turn number when asked', () => {
      mockSections.mockReturnValue(splitPair());
      const { result } = renderHook(() =>
        useLastCornerComparison(true, 'number')
      );

      drive(0.1, 0.29);

      expect(result.current.map((e) => e.label)).toEqual(['T1B', 'T1A']);
      // The id does not move with the label style, so history survives the
      // setting being toggled.
      expect(result.current.map((e) => e.sectionId)).toEqual([
        'acque_minerali_b',
        'acque_minerali_a',
      ]);
    });

    it('uses the track data turn numbers where it has them', () => {
      // T4, not the T1 a count off the corners would give it.
      mockSections.mockReturnValue([
        corner({
          section_id: 'turn-4',
          corner_number: 'T4',
          start_pct: 0.2,
          end_pct: 0.25,
        }),
        corner({
          section_id: 'turn-4',
          corner_number: 'T4',
          start_pct: 0.25,
          end_pct: 0.28,
        }),
      ]);
      const { result } = renderHook(() =>
        useLastCornerComparison(true, 'number')
      );

      drive(0.1, 0.29);

      expect(result.current.map((e) => e.label)).toEqual(['T4B', 'T4A']);
    });

    it('counts turn numbers off the corners when the data has none', () => {
      mockSections.mockReturnValue([
        corner({
          section_id: 'tosa',
          name: 'Tosa',
          corner_number: undefined,
          start_pct: 0.2,
          end_pct: 0.25,
        }),
        corner({
          section_id: 'piratella',
          name: 'Piratella',
          corner_number: undefined,
          start_pct: 0.3,
          end_pct: 0.35,
        }),
      ]);
      const { result } = renderHook(() =>
        useLastCornerComparison(true, 'number')
      );

      drive(0.1, 0.36);

      expect(result.current.map((e) => e.label)).toEqual(['T2', 'T1']);
    });
  });

  describe('brake-point delta', () => {
    // corner() spans 0.2..0.25 of a 5000 m track, i.e. 1000..1250 m.
    // setLiveBrakeOn runs after the first recorded frame: that frame resets the
    // fresh activeLap in place (the "first frame after initialize" branch in
    // LapTraceStore), which would otherwise wipe a brake point poked in
    // beforehand.
    it('reports how many metres later the driver braked than the reference', () => {
      seedReferenceWithBrakeEvent(980);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(987);
      drive(0.1905, 0.26);

      expect(result.current[0]?.brakePointDeltaM).toBe(7);
    });

    it('reports how many metres earlier the driver braked than the reference', () => {
      seedReferenceWithBrakeEvent(980);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(973);
      drive(0.1905, 0.26);

      expect(result.current[0]?.brakePointDeltaM).toBe(-7);
    });

    it('reports a big difference rather than dropping the number', () => {
      // The regression this exists for. A fixed 60 m radius around the
      // reference point used to return null here, so braking a long way off —
      // the difference most worth reading — showed no number at all, and a
      // blank chip reads as "the reference took this corner flat".
      seedReferenceWithBrakeEvent(980);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(900);
      drive(0.1905, 0.26);

      expect(result.current[0]?.brakePointDeltaM).toBe(-80);
    });

    it('ignores braking too far back to belong to this corner', () => {
      // 400 m before the corner's start (1000 m) is the reach.
      seedReferenceWithBrakeEvent(980);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(550);
      drive(0.1905, 0.26);

      expect(result.current[0]?.brakePointDeltaM).toBeNull();
      expect(result.current[0]?.timeDeltaSec).not.toBeNull();
    });

    it('leaves brakePointDeltaM null without blanking time/apex-speed when nothing pairs', () => {
      seedReferenceWithBrakeEvent(980);
      // No live brake point recorded — activeLap.brakeOnCount stays 0.
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.26);

      expect(result.current[0]?.brakePointDeltaM).toBeNull();
      expect(result.current[0]?.timeDeltaSec).not.toBeNull();
    });

    it('times the corner from the sample clocks, not a grid', () => {
      // Reference at 20 m/s, driver at 18 m/s through a 250 m corner:
      // 250/18 - 250/20 = 0.694 s, to well under the 10 ms the panel shows.
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.26);

      expect(result.current[0]?.timeDeltaSec).toBeCloseTo(
        250 / 18 - 250 / 20,
        2
      );
    });

    it('lists a corner the reference took flat, with no brake delta', () => {
      // Two corners; the reference only brakes for the first (950 m, just
      // before turn-1's 1000 m start). turn-2 is a fast corner nobody braked
      // for: it is still listed, with its time and apex-speed deltas, and no
      // brake number rather than a borrowed one.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.5, // 2500 m, well clear of the 950 m brake point
          end_pct: 0.55,
        }),
      ]);
      seedReferenceWithBrakeEvent(950);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.56);

      const turn2 = result.current.find((e) => e.sectionId === 'turn-2');
      expect(turn2?.timeDeltaSec).not.toBeNull();
      expect(turn2?.brakePointDeltaM).toBeNull();
    });

    it('never gives a corner the brake point of the corner after it', () => {
      // The Okayama symptom: a fast link corner (turn-1, 1000..1250 m) runs
      // straight into a braking corner (turn-2, starting 1400 m) whose brake
      // point at 1330 m sits *ahead* of the link. A symmetric search used to
      // hand it to the link corner, listing a corner nobody brakes for with
      // the real corner's number.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.28,
          end_pct: 0.32,
        }),
      ]);
      seedReferenceWithBrakeEvent(1330);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(1330);
      drive(0.1905, 0.33);

      const turn1 = result.current.find((e) => e.sectionId === 'turn-1');
      const turn2 = result.current.find((e) => e.sectionId === 'turn-2');
      expect(turn1?.brakePointDeltaM).toBeNull();
      expect(turn2?.brakePointDeltaM).toBe(0);
    });

    it('registers a brake point that began inside a fast, no-braking previous corner', () => {
      // The reference brakes at 1180 m — geometrically inside corner 1
      // (1000..1250) but only 100 m before T2's start (1280). Corner 1 has no
      // entry brake of its own, so this is T2's brake point.
      mockSections.mockReturnValue([
        corner(),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.256,
          end_pct: 0.3,
        }),
      ]);
      seedReferenceWithBrakeEvent(1180);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.19);
      setLiveBrakeOn(1185);
      drive(0.1905, 0.31);

      const turn2 = result.current.find((e) => e.sectionId === 'turn-2');
      // Driver braked at 1185, reference at 1180: five metres later.
      expect(turn2?.brakePointDeltaM).toBe(5);
      expect(turn2?.timeDeltaSec).not.toBeNull();
    });
  });

  describe('close corners', () => {
    // The track data joins adjacent corners with gaps of 0.001 of a lap
    // (3-4 m), which one frame can cover at speed.
    const closePair = () => [
      corner(),
      corner({
        section_id: 'turn-2',
        corner_number: 'T2',
        start_pct: 0.251,
        end_pct: 0.3,
      }),
    ];

    it('reports both corners of a joined pair, in order', () => {
      mockSections.mockReturnValue(closePair());
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.31);

      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-2',
        'turn-1',
      ]);
    });

    it('reports every corner cleared between two delivered ticks', () => {
      // Three short corners back to back, all driven between one delivery and
      // the next — the recorder keeps every sample, but the panel only gets
      // woken twice. All three must still be reported, in order.
      mockSections.mockReturnValue([
        corner({ start_pct: 0.2, end_pct: 0.21 }),
        corner({
          section_id: 'turn-2',
          corner_number: 'T2',
          start_pct: 0.211,
          end_pct: 0.22,
        }),
        corner({
          section_id: 'turn-3',
          corner_number: 'T3',
          start_pct: 0.221,
          end_pct: 0.23,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.1, 0.199);
      expect(result.current).toHaveLength(0);

      // Every frame is recorded, but only the last of them wakes the panel.
      let last = sampleAt(0.199, 18);
      for (let pct = 0.1995; pct <= 0.24; pct += FRAME_PCT) {
        frameTime += (FRAME_PCT * TRACK_LENGTH_M) / 18;
        last = sampleAt(pct, 18);
        recordOnly(last);
      }
      deliverOnly(last);

      expect(result.current.map((e) => e.sectionId)).toEqual([
        'turn-3',
        'turn-2',
        'turn-1',
      ]);
    });

    it('is not stranded by a chain of 3+ overlapping/nested track sections', () => {
      // Sections in the bundled data overlap on a handful of tracks. A corner
      // nested inside an earlier one must not leave the panel unable to report
      // anything for the rest of the lap.
      mockSections.mockReturnValue([
        corner({
          section_id: 'complex',
          corner_number: 'Complex',
          type: 'complex',
          start_pct: 0.1,
          end_pct: 0.3,
        }),
        corner({
          section_id: 'becketts',
          corner_number: 'Becketts',
          start_pct: 0.16,
          end_pct: 0.2,
        }),
        corner({
          section_id: 'chapel',
          corner_number: 'Chapel',
          start_pct: 0.21,
          end_pct: 0.25,
        }),
        corner({
          section_id: 'turn-after',
          corner_number: 'TA',
          start_pct: 0.4,
          end_pct: 0.45,
        }),
      ]);
      const { result } = renderHook(() => useLastCornerComparison(true));

      drive(0.05, 0.46);

      // turn-after, well clear of the complex, must still register on this lap.
      expect(result.current.map((e) => e.sectionId)).toContain('turn-after');
    });
  });
});

describe('useLastCornerLabels', () => {
  beforeEach(() => {
    // No corner_number, so 'name' style reports the names: baseLabelOf prefers
    // the number wherever the track data supplies one.
    mockSections.mockReturnValue([
      corner({
        section_id: 'a',
        name: 'Tamburello',
        corner_number: undefined,
      }),
      corner({
        section_id: 'b',
        name: 'Rivazza',
        corner_number: undefined,
        start_pct: 0.5,
        end_pct: 0.55,
      }),
    ]);
  });

  it('names every corner on the track, not only the ones driven', () => {
    const { result } = renderHook(() => useLastCornerLabels(true));

    expect(result.current).toEqual(['Tamburello', 'Rivazza']);
  });

  it('follows the configured label style', () => {
    const { result } = renderHook(() => useLastCornerLabels(true, 'number'));

    expect(result.current).toEqual(['T1', 'T2']);
  });

  it('skips the work entirely when the panel is switched off', () => {
    const { result } = renderHook(() => useLastCornerLabels(false));

    expect(result.current).toEqual([]);
  });

  it('keeps the same array identity across renders', () => {
    // The panel derives a column width from this; a fresh array every render
    // would re-run that measurement for nothing.
    const { result, rerender } = renderHook(() => useLastCornerLabels(true));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
