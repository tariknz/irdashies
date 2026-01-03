import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSessionIsOfficial, useSessionStore } from './SessionStore';
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
});
