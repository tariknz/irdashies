import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionVisibility } from './useSessionVisibility';
import { useCurrentSessionType } from './useCurrentSessionType';

vi.mock('./useCurrentSessionType', () => ({
  useCurrentSessionType: vi.fn(),
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
});
