import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useSessionIsOfficial,
  useSessionList,
  useSessionStore,
} from './SessionStore';
import type { Session } from '@irdashies/types';

describe('SessionStore', () => {
  describe('useSessionIsOfficial', () => {
    it('should return true when session is official', () => {
      const mockSession = {
        WeekendInfo: {
          Official: 1,
        },
      } as Session;

      useSessionStore.getState().setSession(mockSession);

      const { result } = renderHook(() => useSessionIsOfficial());
      expect(result.current).toBe(true);
    });

    it('should return false when session is not official', () => {
      const mockSession = {
        WeekendInfo: {
          Official: 0,
        },
      } as Session;

      useSessionStore.getState().setSession(mockSession);

      const { result } = renderHook(() => useSessionIsOfficial());
      expect(result.current).toBe(false);
    });

    it('should return false when session is null', () => {
      useSessionStore.getState().setSession(null as unknown as Session);

      const { result } = renderHook(() => useSessionIsOfficial());
      expect(result.current).toBe(false);
    });

    it('should return false when WeekendInfo is undefined', () => {
      const mockSession = {
        SessionInfo: {},
        CameraInfo: {},
        RadioInfo: {},
        DriverInfo: {},
        SplitTimeInfo: {},
        QualifyResultsInfo: {},
      } as Session;
      useSessionStore.getState().setSession(mockSession);

      const { result } = renderHook(() => useSessionIsOfficial());
      expect(result.current).toBe(false);
    });
  });

  describe('useSessionList', () => {
    const sessionWith = (
      names: string[],
      extra: Record<string, unknown> = {}
    ) =>
      ({
        SessionInfo: {
          Sessions: names.map((name, i) => ({
            SessionNum: i,
            SessionName: name,
            SessionType: name,
            ResultsPositions: [],
            ...extra,
          })),
        },
      }) as unknown as Session;

    it('returns number, name and type for each session', () => {
      useSessionStore.getState().setSession(sessionWith(['PRACTICE', 'RACE']));

      const { result } = renderHook(() => useSessionList());
      expect(result.current).toEqual([
        { SessionNum: 0, SessionName: 'PRACTICE', SessionType: 'PRACTICE' },
        { SessionNum: 1, SessionName: 'RACE', SessionType: 'RACE' },
      ]);
    });

    it('keeps the same array when only other session fields change', () => {
      useSessionStore.getState().setSession(sessionWith(['PRACTICE', 'RACE']));
      const { result } = renderHook(() => useSessionList());
      const first = result.current;

      act(() =>
        useSessionStore
          .getState()
          .setSession(sessionWith(['PRACTICE', 'RACE'], { SessionLaps: 10 }))
      );

      expect(result.current).toBe(first);
    });

    it('returns undefined when there is no session', () => {
      useSessionStore.getState().setSession(null as unknown as Session);

      const { result } = renderHook(() => useSessionList());
      expect(result.current).toBeUndefined();
    });
  });
});
