import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  GlobalFlags,
  LMU_FINISH_STATUS,
  LMU_PIT_STATE,
  type StandingsSnapshot,
} from '@irdashies/types';
import { useStandingsSnapshot } from '@irdashies/context';
import { useCarState } from './useDriverPositions';

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return { ...actual, useStandingsSnapshot: vi.fn() };
});

const snapshot = (over: Partial<StandingsSnapshot>) =>
  ({
    carIdxTrackSurface: [3, 3, 3, 3, 3],
    ...over,
  }) as StandingsSnapshot;

describe('useCarState', () => {
  beforeEach(() => {
    vi.mocked(useStandingsSnapshot).mockReset();
  });

  it('maps pit state 1 to pitRequested', () => {
    vi.mocked(useStandingsSnapshot).mockReturnValue(
      snapshot({
        carIdxPitState: [
          LMU_PIT_STATE.none,
          LMU_PIT_STATE.requested,
          LMU_PIT_STATE.entering,
          LMU_PIT_STATE.stopped,
          LMU_PIT_STATE.exiting,
        ],
      })
    );

    const { result } = renderHook(() => useCarState());

    expect(result.current.map((c) => c.pitRequested)).toEqual([
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('keeps dnf on the Disqualify flag rather than the finish state', () => {
    vi.mocked(useStandingsSnapshot).mockReturnValue(
      snapshot({
        carIdxFinishStatus: [
          LMU_FINISH_STATUS.none,
          LMU_FINISH_STATUS.dnf,
          LMU_FINISH_STATUS.dq,
          LMU_FINISH_STATUS.dq,
          LMU_FINISH_STATUS.finished,
        ],
        carIdxSessionFlags: [0, 0, 0, GlobalFlags.Disqualify, 0],
      })
    );

    const { result } = renderHook(() => useCarState());

    expect(result.current.map((c) => c.dnf)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(result.current.map((c) => c.finishState)).toEqual([
      undefined,
      'DNF',
      'DQ',
      'DQ',
      'FINISHED',
    ]);
  });
});
