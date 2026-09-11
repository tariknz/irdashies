import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ChannelBridge,
  LapTraceSampleSnapshot,
  Session,
} from '@irdashies/types';
import { useLapTraceRecorder } from './useLapTraceRecorder';
import { useLapTraceStore } from './LapTraceStore';
import { useSessionStore } from '../SessionStore/SessionStore';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let referenceUpdatedCb: (() => void) | undefined;
let clearBestCb: (() => void) | undefined;

const mockBridge = {
  getLapTrace: vi.fn().mockResolvedValue(null),
  saveLapTrace: vi.fn().mockResolvedValue(undefined),
  clearLapTrace: vi.fn().mockResolvedValue(undefined),
  pickAndParseIbtLap: vi.fn(),
  fetchLapTraceFromGarage61: vi.fn(),
  pickGarage61Csv: vi.fn(),
  notifyReferenceUpdated: vi.fn(),
  onReferenceUpdated: vi.fn((cb: () => void) => {
    referenceUpdatedCb = cb;
    return () => {
      referenceUpdatedCb = undefined;
    };
  }),
  requestClearBestLap: vi.fn(),
  onClearBestLap: vi.fn((cb: () => void) => {
    clearBestCb = cb;
    return () => {
      clearBestCb = undefined;
    };
  }),
  getCurrentBestLapInfo: vi.fn().mockResolvedValue(null),
  getGarage61SearchInfo: vi.fn().mockResolvedValue(null),
};

type ChannelCallback = (payload: unknown) => void;
let sampleCallback: ChannelCallback | undefined;
let subscribedRate: number | undefined;

const setSession = (overrides: Record<string, unknown> = {}) => {
  useSessionStore.setState({
    session: {
      WeekendInfo: {
        TrackID: 2,
        SubSessionID: 3,
        TrackLength: '5 km',
        TrackConfigName: 'Grand Prix',
        ...overrides,
      },
      DriverInfo: {
        DriverCarIdx: 1,
        Drivers: [
          { CarIdx: 0, CarPath: 'othercar' },
          { CarIdx: 1, CarPath: 'mycar' },
        ],
      },
    } as unknown as Session,
  });
};

let version = 0;

/** Publishes one co-sampled frame on the recorder's channel. */
const publishSample = (overrides: Partial<LapTraceSampleSnapshot> = {}) => {
  sampleCallback?.({
    sessionTime: 10,
    lapDistPct: 0.5,
    throttle: 1,
    brake: 0,
    speed: 50,
    gear: 4,
    brakeAbsActive: false,
    onPitRoad: false,
    isOnTrack: true,
    sessionNum: 0,
    lastLapTime: 0,
    lapCompleted: 0,
    incidentCount: 0,
    version: ++version,
    ...overrides,
  } satisfies LapTraceSampleSnapshot);
};

describe('useLapTraceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridge.getLapTrace.mockResolvedValue(null);
    window.lapTraceBridge = mockBridge;

    sampleCallback = undefined;
    subscribedRate = undefined;
    const subscribe = vi.fn(
      (channel: string, callback: ChannelCallback, rateHz?: number) => {
        if (channel === 'lap-trace.sample') {
          sampleCallback = callback;
          subscribedRate = rateHz;
        }
        return () => {
          if (channel === 'lap-trace.sample') sampleCallback = undefined;
        };
      }
    );
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    useLapTraceStore.getState().reset();
    useSessionStore.setState({ session: null });
  });

  afterEach(() => {
    delete window.lapTraceBridge;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;
  });

  it('initializes with the track length parsed to metres', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();

    expect(initialize).toHaveBeenCalledWith(
      mockBridge,
      2,
      'Grand Prix',
      'mycar',
      5000
    );
  });

  it('initializes from a session that is already loaded', () => {
    // Alt+H unmounts the recorder and remounts it later against a session
    // store that never changed in between. Without seeding, `subscribe` would
    // stay silent until iRacing next republished, which in a solo stint may
    // not happen at all.
    setSession();
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');

    renderHook(() => useLapTraceRecorder('best'));

    expect(initialize).toHaveBeenCalledWith(
      mockBridge,
      2,
      'Grand Prix',
      'mycar',
      5000
    );
  });

  it('re-initializes after a remount with no session change', () => {
    setSession();
    const first = renderHook(() => useLapTraceRecorder('best'));
    first.unmount();

    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    expect(initialize).toHaveBeenCalledWith(
      mockBridge,
      2,
      'Grand Prix',
      'mycar',
      5000
    );
  });

  it('resolves the player car by CarIdx, not array position', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    useSessionStore.setState({
      session: {
        WeekendInfo: {
          TrackID: 2,
          SubSessionID: 3,
          TrackLength: '5 km',
          TrackConfigName: '',
        },
        DriverInfo: {
          DriverCarIdx: 7,
          Drivers: [
            { CarIdx: 3, CarPath: 'wrongcar' },
            { CarIdx: 7, CarPath: 'rightcar' },
          ],
        },
      } as unknown as Session,
    });

    expect(initialize).toHaveBeenCalledWith(
      mockBridge,
      2,
      '',
      'rightcar',
      5000
    );
  });

  it('does not initialize before the player car is known', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    useSessionStore.setState({
      session: {
        WeekendInfo: { TrackID: 2, SubSessionID: 3, TrackLength: '5 km' },
        DriverInfo: { DriverCarIdx: -1, Drivers: [] },
      } as unknown as Session,
    });

    expect(initialize).not.toHaveBeenCalled();
  });

  it('does not initialize without a valid track id', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession({ TrackID: 0 });

    expect(initialize).not.toHaveBeenCalled();
  });

  it('does not initialize on an unparseable track length', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession({ TrackLength: undefined });

    expect(initialize).not.toHaveBeenCalled();
  });

  it('re-initializes when the track config changes', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();
    setSession({ TrackConfigName: 'Reverse' });

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenLastCalledWith(
      mockBridge,
      2,
      'Reverse',
      'mycar',
      5000
    );
  });

  it('does not re-initialize when nothing relevant changed', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();
    setSession();
    setSession();

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('subscribes to the co-sampled channel at the full 60 Hz', () => {
    renderHook(() => useLapTraceRecorder('best'));
    expect(sampleCallback).toBeDefined();
    expect(subscribedRate).toBe(60);
  });

  it('feeds every sample frame into the recorder as-is', () => {
    const collect = vi.spyOn(useLapTraceStore.getState(), 'collectPlayerFrame');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();
    publishSample();

    expect(collect).toHaveBeenCalledWith(
      mockBridge,
      expect.objectContaining({
        lapDistPct: 0.5,
        sessionTime: 10,
        throttle: 1,
        brake: 0,
        speed: 50,
        gear: 4,
      })
    );
  });

  it('passes the telemetry lap time and completed-lap count through', () => {
    const collect = vi.spyOn(useLapTraceStore.getState(), 'collectPlayerFrame');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();
    publishSample({ lastLapTime: 96.797, lapCompleted: 12 });

    expect(collect).toHaveBeenLastCalledWith(
      mockBridge,
      expect.objectContaining({ lastLapTime: 96.797, lapCompleted: 12 })
    );
  });

  it('reloads the reference when Settings signals an import or clear', () => {
    const setReference = vi.spyOn(
      useLapTraceStore.getState(),
      'setReferenceFromSource'
    );
    renderHook(() => useLapTraceRecorder('best'));
    setSession();
    setReference.mockClear();

    act(() => referenceUpdatedCb?.());

    expect(setReference).toHaveBeenCalledWith(mockBridge, 'best');
  });

  it('clears the best lap when Settings requests a reset', () => {
    const clearBest = vi.spyOn(useLapTraceStore.getState(), 'clearBestLap');
    renderHook(() => useLapTraceRecorder('best'));
    setSession();

    act(() => clearBestCb?.());

    expect(clearBest).toHaveBeenCalledWith(mockBridge);
  });

  it('ignores sample frames before the session is known', () => {
    const collect = vi.spyOn(useLapTraceStore.getState(), 'collectPlayerFrame');
    renderHook(() => useLapTraceRecorder('best'));

    publishSample();

    expect(collect).not.toHaveBeenCalled();
  });

  it('restarts the recorder when SessionNum changes', () => {
    const initialize = vi.spyOn(useLapTraceStore.getState(), 'initialize');
    renderHook(() => useLapTraceRecorder('best'));

    setSession();
    // First frame just establishes the baseline SessionNum (0); no restart yet.
    publishSample();
    expect(initialize).toHaveBeenCalledTimes(1);

    publishSample({ sessionNum: 1 });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('loads the reference for the configured source', () => {
    const setReference = vi.spyOn(
      useLapTraceStore.getState(),
      'setReferenceFromSource'
    );
    renderHook(() => useLapTraceRecorder('manual'));

    expect(setReference).toHaveBeenCalledWith(mockBridge, 'manual');
  });

  it('reloads the reference when the source setting changes', () => {
    const setReference = vi.spyOn(
      useLapTraceStore.getState(),
      'setReferenceFromSource'
    );
    const { rerender } = renderHook(
      ({ source }) => useLapTraceRecorder(source),
      { initialProps: { source: 'best' as const } }
    );

    setReference.mockClear();
    rerender({ source: 'garage61' as unknown as 'best' });

    expect(setReference).toHaveBeenCalledWith(mockBridge, 'garage61');
  });

  it('resets the store on unmount so a stale lap does not survive', () => {
    const reset = vi.spyOn(useLapTraceStore.getState(), 'reset');
    const { unmount } = renderHook(() => useLapTraceRecorder('best'));

    setSession();
    unmount();

    expect(reset).toHaveBeenCalled();
  });

  it('stops recording after unmount', () => {
    const { unmount } = renderHook(() => useLapTraceRecorder('best'));
    setSession();
    unmount();

    expect(sampleCallback).toBeUndefined();

    const collect = vi.spyOn(useLapTraceStore.getState(), 'collectPlayerFrame');
    publishSample();

    expect(collect).not.toHaveBeenCalled();
  });
});
