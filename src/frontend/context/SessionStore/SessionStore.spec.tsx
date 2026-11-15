import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useSessionIsOfficial,
  useSessionDrivers,
  useSessionList,
  useSessionStore,
} from './SessionStore';
import type { Session } from '@irdashies/types';

describe('SessionStore', () => {
  describe('useSessionDrivers', () => {
    const sessionWithDrivers = (drivers: unknown[]) =>
      ({ DriverInfo: { Drivers: drivers } }) as unknown as Session;

    it('retains the selection for equal IPC records and publishes real changes', () => {
      const drivers = [{ CarIdx: 1, UserName: 'Alice', IRating: 2000 }];
      // Both payloads cross the same clone boundary. In JSDOM, structuredClone
      // produces Node-realm objects with a different prototype from literals.
      useSessionStore
        .getState()
        .setSession(sessionWithDrivers(structuredClone(drivers)));
      const { result } = renderHook(() => useSessionDrivers());
      const selected = result.current;

      act(() => {
        useSessionStore
          .getState()
          .setSession(sessionWithDrivers(structuredClone(drivers)));
      });
      expect(result.current).toBe(selected);

      act(() => {
        useSessionStore
          .getState()
          .setSession(
            sessionWithDrivers(
              structuredClone([{ ...drivers[0], IRating: 2100 }])
            )
          );
      });
      expect(result.current).not.toBe(selected);
      expect(result.current?.[0].IRating).toBe(2100);

      act(() => useSessionStore.getState().resetSession());
      expect(result.current).toBeUndefined();
    });

    it('preserves nested rating identity semantics after IPC cloning', () => {
      const drivers = [{ CarIdx: 1, LmuRating: { driverTier: 2 } }];
      useSessionStore
        .getState()
        .setSession(sessionWithDrivers(structuredClone(drivers)));
      const { result } = renderHook(() => useSessionDrivers());
      const selected = result.current;

      act(() => {
        useSessionStore
          .getState()
          .setSession(sessionWithDrivers(structuredClone(drivers)));
      });
      expect(result.current).not.toBe(selected);
      expect(result.current).toEqual(selected);
    });
  });

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
