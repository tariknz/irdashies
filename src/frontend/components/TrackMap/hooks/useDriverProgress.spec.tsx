import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelPayloads,
  Session,
  TrackStateSnapshot,
} from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { useDriverProgress } from './useDriverProgress';

const createSource = () => {
  let publishTrackState: ((snapshot: TrackStateSnapshot) => void) | undefined;
  const bridge: ChannelBridge = {
    subscribe: (channel, callback) => {
      if (channel === 'track-state.snapshot') {
        publishTrackState = callback as (snapshot: TrackStateSnapshot) => void;
      }
      return vi.fn();
    },
  };

  return {
    bridge,
    publishTrackState: (snapshot: TrackStateSnapshot) =>
      publishTrackState?.(snapshot as ChannelPayloads['track-state.snapshot']),
  };
};

const driver = (carIdx: number, carNumber = String(carIdx + 1)) =>
  ({
    CarIdx: carIdx,
    CarNumber: carNumber,
    CarClassID: 1,
    CarIsPaceCar: false,
    IsSpectator: false,
  }) as unknown as NonNullable<Session['DriverInfo']>['Drivers'][number];

const setSession = (
  drivers: ReturnType<typeof driver>[],
  qualifyPositions: { CarIdx: number; ClassPosition: number }[] = [],
  qualifyingResults: { CarIdx: number; ClassPosition: number }[] = [],
  paceCarIdx = -1
) => {
  act(() =>
    useSessionStore.getState().setSession({
      DriverInfo: {
        Drivers: drivers,
        DriverCarIdx: 0,
        PaceCarIdx: paceCarIdx,
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 1, QualifyPositions: qualifyPositions },
          {
            SessionNum: 2,
            QualifyPositions: qualifyPositions.map((position, index) => ({
              ...position,
              ClassPosition: qualifyPositions.length - index,
            })),
          },
        ],
      },
      QualifyResultsInfo: { Results: qualifyingResults },
    } as unknown as Session)
  );
};

const trackState = (
  overrides: Partial<TrackStateSnapshot> = {}
): TrackStateSnapshot =>
  ({
    focusCarIdx: null,
    carIdxLapDistPct: [0.1, 0.2],
    carIdxClassPosition: [1, 2],
    sessionNum: 1,
    ...overrides,
  }) as TrackStateSnapshot;

afterEach(() => {
  useSessionStore.getState().resetSession();
});

describe('useDriverProgress', () => {
  it('keeps identities stable across progress updates and equal fresh class arrays', () => {
    const source = createSource();
    window.channelBridge = source.bridge;
    setSession([driver(0), driver(1)]);
    const { result } = renderHook(() => useDriverProgress());

    act(() => source.publishTrackState(trackState()));
    const initialIdentities = result.current.identities;
    expect(initialIdentities).toHaveLength(2);

    act(() =>
      source.publishTrackState(
        trackState({
          carIdxLapDistPct: [0.15, 0.25],
          carIdxClassPosition: [1, 2],
        })
      )
    );

    expect(result.current.identities).toBe(initialIdentities);
    expect(result.current.drivers.map(({ progress }) => progress)).toEqual([
      0.15, 0.25,
    ]);
  });

  it('handles class-position array length and undefined transitions', () => {
    const source = createSource();
    window.channelBridge = source.bridge;
    setSession([driver(0), driver(1)]);
    const { result } = renderHook(() => useDriverProgress());

    act(() => source.publishTrackState(trackState()));
    const initial = result.current.identities;

    act(() =>
      source.publishTrackState(trackState({ carIdxClassPosition: [] }))
    );
    const emptyPositions = result.current.identities;
    expect(emptyPositions).not.toBe(initial);

    act(() =>
      source.publishTrackState(
        trackState({
          carIdxClassPosition: undefined as unknown as readonly number[],
        })
      )
    );
    const undefinedPositions = result.current.identities;
    expect(undefinedPositions).not.toBe(emptyPositions);

    act(() =>
      source.publishTrackState(
        trackState({
          carIdxLapDistPct: [0.4, 0.5],
          carIdxClassPosition: undefined as unknown as readonly number[],
        })
      )
    );
    expect(result.current.identities).toBe(undefinedPositions);
    expect(result.current.drivers.map(({ progress }) => progress)).toEqual([
      0.4, 0.5,
    ]);
  });

  it('continues to exclude the pace car', () => {
    const source = createSource();
    window.channelBridge = source.bridge;
    setSession([driver(0), { ...driver(1, 'PC'), CarIsPaceCar: 1 }], [], [], 1);
    const { result } = renderHook(() => useDriverProgress());

    act(() =>
      source.publishTrackState(trackState({ carIdxLapDistPct: [0.1, 0.2] }))
    );

    expect(
      result.current.drivers.map(({ driver: entry }) => entry.CarIdx)
    ).toEqual([0]);
  });

  it('recomputes identities for class positions, focus, session, and roster changes', () => {
    const source = createSource();
    window.channelBridge = source.bridge;
    setSession(
      [driver(0), driver(1)],
      [
        { CarIdx: 0, ClassPosition: 3 },
        { CarIdx: 1, ClassPosition: 4 },
      ]
    );
    const { result } = renderHook(() => useDriverProgress());
    act(() =>
      source.publishTrackState(trackState({ carIdxClassPosition: [0, 0] }))
    );
    const first = result.current.identities;
    expect(first.map(({ classPosition }) => classPosition)).toEqual([1, 2]);

    act(() =>
      source.publishTrackState(trackState({ carIdxClassPosition: [2, 1] }))
    );
    const classChanged = result.current.identities;
    expect(classChanged).not.toBe(first);
    expect(classChanged.map(({ classPosition }) => classPosition)).toEqual([
      2, 1,
    ]);

    act(() =>
      source.publishTrackState(
        trackState({ focusCarIdx: 1, carIdxClassPosition: [0, 0] })
      )
    );
    const focusChanged = result.current.identities;
    expect(focusChanged).not.toBe(classChanged);
    expect(focusChanged.map(({ isPlayer }) => isPlayer)).toEqual([false, true]);

    act(() =>
      source.publishTrackState(
        trackState({
          sessionNum: 2,
          focusCarIdx: 1,
          carIdxClassPosition: [0, 0],
        })
      )
    );
    const sessionNumChanged = result.current.identities;
    expect(sessionNumChanged).not.toBe(focusChanged);
    expect(sessionNumChanged.map(({ classPosition }) => classPosition)).toEqual(
      [2, 1]
    );

    setSession(
      [driver(0), driver(1)],
      [
        { CarIdx: 0, ClassPosition: 3 },
        { CarIdx: 1, ClassPosition: 4 },
      ],
      [
        { CarIdx: 0, ClassPosition: 2 },
        { CarIdx: 1, ClassPosition: 1 },
      ]
    );
    const sessionDataChanged = result.current.identities;
    expect(sessionDataChanged).not.toBe(sessionNumChanged);
    expect(
      sessionDataChanged.map(({ classPosition }) => classPosition)
    ).toEqual([2, 1]);

    setSession([driver(0), driver(1), driver(2)]);
    expect(result.current.identities).not.toBe(sessionDataChanged);
    expect(
      result.current.identities.map(({ driver: entry }) => entry.CarIdx)
    ).toEqual([0, 1, 2]);
  });

  it('memoizes the qualifying-position fallback while progress changes', () => {
    const source = createSource();
    window.channelBridge = source.bridge;
    setSession(
      [driver(0, '10'), driver(1, '2')],
      [
        { CarIdx: 0, ClassPosition: 2 },
        { CarIdx: 1, ClassPosition: 1 },
      ]
    );
    const { result } = renderHook(() => useDriverProgress());

    act(() =>
      source.publishTrackState(trackState({ carIdxClassPosition: [0, 0] }))
    );
    const initialIdentities = result.current.identities;
    expect(initialIdentities.map(({ classPosition }) => classPosition)).toEqual(
      [2, 1]
    );

    act(() =>
      source.publishTrackState(
        trackState({
          carIdxLapDistPct: [0.3, 0.4],
          carIdxClassPosition: [0, 0],
        })
      )
    );

    expect(result.current.identities).toBe(initialIdentities);
  });
});
