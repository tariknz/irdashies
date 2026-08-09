import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as context from '@irdashies/context';
import { EngineWarnings } from '@irdashies/types';
import { usePitLimiterWarning } from './usePitLimiterWarning';

vi.mock('@irdashies/context', () => ({
  useTrackStateSelector: vi.fn(),
  useSessionStore: vi.fn(),
}));

const trackState = (
  values: Partial<{
    onPitRoad: boolean;
    pitSpeedLimiterToggle: boolean;
    pitstopActive: boolean;
    engineWarnings: number;
  }> = {}
) => {
  const snapshot = {
    onPitRoad: false,
    pitSpeedLimiterToggle: false,
    pitstopActive: false,
    engineWarnings: 0,
    ...values,
  };
  vi.mocked(context.useTrackStateSelector).mockImplementation(
    (selector) => selector(snapshot as never) as never
  );
};

const sessionStore = { session: { WeekendInfo: { TeamRacing: 0 } } };

describe('usePitLimiterWarning', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStore.session.WeekendInfo.TeamRacing = 0;
    trackState();
    vi.mocked(context.useSessionStore).mockImplementation(
      (selector) => selector(sessionStore as never) as never
    );
  });

  it('reads the typed track-state snapshot', () => {
    renderHook(() => usePitLimiterWarning(true));
    expect(context.useTrackStateSelector).toHaveBeenCalledOnce();
  });

  it('warns when entering pit road without a limiter', () => {
    trackState({ onPitRoad: true });
    const { result } = renderHook(() => usePitLimiterWarning(true));

    expect(result.current).toMatchObject({
      showWarning: true,
      isTeamRaceWarning: false,
      warningText: 'ACTIVATE LIMITER',
    });
  });

  it('does not warn when the limiter is engaged', () => {
    trackState({
      onPitRoad: true,
      pitSpeedLimiterToggle: true,
      engineWarnings: EngineWarnings.PitSpeedLimiter,
    });
    const { result } = renderHook(() => usePitLimiterWarning(true));

    expect(result.current.showWarning).toBe(false);
  });

  it('warns when a manual toggle follows auto-limiter detection', () => {
    trackState({ onPitRoad: false });
    const { result, rerender } = renderHook(() => usePitLimiterWarning(true));

    trackState({
      onPitRoad: true,
      engineWarnings: EngineWarnings.PitSpeedLimiter,
    });
    rerender();

    trackState({
      onPitRoad: true,
      pitSpeedLimiterToggle: true,
      engineWarnings: EngineWarnings.PitSpeedLimiter,
    });
    rerender();

    expect(result.current.warningText).toBe('DISABLE LIMITER');
  });

  it('warns a team after pitstop completion without a limiter', () => {
    sessionStore.session.WeekendInfo.TeamRacing = 1;
    trackState({ pitstopActive: true });
    const { result, rerender } = renderHook(() => usePitLimiterWarning(true));

    trackState({ pitstopActive: false });
    rerender();

    expect(result.current).toMatchObject({
      showWarning: true,
      isTeamRaceWarning: true,
      warningText: 'ACTIVATE LIMITER',
    });
  });

  it('returns no warning when disabled', () => {
    trackState({ onPitRoad: true });
    const { result } = renderHook(() => usePitLimiterWarning(false));

    expect(result.current).toEqual({
      showWarning: false,
      isTeamRaceWarning: false,
      warningText: '',
    });
  });

  it('clears the team warning when the limiter is activated', () => {
    sessionStore.session.WeekendInfo.TeamRacing = 1;
    trackState({ pitstopActive: true });
    const { result, rerender } = renderHook(() => usePitLimiterWarning(true));
    trackState({ pitstopActive: false });
    rerender();

    act(() => {
      trackState({ pitSpeedLimiterToggle: true });
      rerender();
    });
    expect(result.current.showWarning).toBe(false);
  });
});
