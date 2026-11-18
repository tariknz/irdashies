import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionVisibility } from './useSessionVisibility';
import { useCurrentSessionType } from './useCurrentSessionType';
import { useTrackStateSelector } from '../ChannelStore';

vi.mock('./useCurrentSessionType', () => ({
  useCurrentSessionType: vi.fn(),
}));

vi.mock('../ChannelStore', () => ({
  trackStateSelectors: { notInSession: vi.fn() },
  useTrackStateSelector: vi.fn(),
}));

const visibility = {
  race: true,
  loneQualify: false,
  openQualify: false,
  practice: false,
  offlineTesting: false,
};

const visibleIn = (
  sessionType: ReturnType<typeof useCurrentSessionType>,
  settings: Parameters<typeof useSessionVisibility>[0] = visibility
) => {
  vi.mocked(useCurrentSessionType).mockReturnValue(sessionType);
  return renderHook(() => useSessionVisibility(settings)).result.current;
};

describe('useSessionVisibility', () => {
  beforeEach(() => {
    vi.mocked(useTrackStateSelector).mockReturnValue(false);
  });

  it('follows the setting for the current session', () => {
    expect(visibleIn('Race')).toBe(true);
    expect(visibleIn('Open Qualify')).toBe(false);
  });

  it('follows warmup when the widget offers it', () => {
    expect(visibleIn('Warmup', { ...visibility, warmup: false })).toBe(false);
  });

  it('shows the widget in sessions it has no setting for', () => {
    expect(visibleIn('Warmup')).toBe(true);
    expect(visibleIn('Lone Practice')).toBe(true);
  });

  describe('out of any session', () => {
    beforeEach(() => {
      vi.mocked(useTrackStateSelector).mockReturnValue(true);
    });

    it('reads as Offline Testing, whatever session was last described', () => {
      // LMU's GetGameState said "unavailable": the race this widget is shown
      // in is over, and only Offline Testing decides.
      expect(visibleIn('Race')).toBe(false);
      expect(visibleIn('Race', { ...visibility, offlineTesting: true })).toBe(
        true
      );
    });

    it('applies even before any session type is known', () => {
      expect(visibleIn(undefined)).toBe(false);
    });

    it('still shows a widget with no visibility settings', () => {
      vi.mocked(useCurrentSessionType).mockReturnValue('Race');
      expect(
        renderHook(() => useSessionVisibility(undefined)).result.current
      ).toBe(true);
    });
  });
});
