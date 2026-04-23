import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@irdashies/context', () => ({
  useCurrentSessionType: vi.fn(),
}));

import { SessionType, useCurrentSessionType } from '@irdashies/context';
import { useSessionVisibility } from './useSessionVisibility';

describe('useSessionVisibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    'Race' as SessionType,
    'Lone Qualify' as SessionType,
    'Open Qualify' as SessionType,
    'Practice' as SessionType,
    'Offline Testing' as SessionType,
  ])(
    'should return true when in session and configuration is set to true for that session',
    (type) => {
      vi.mocked(useCurrentSessionType).mockReturnValue(type);

      const visible = useSessionVisibility({
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      });

      expect(visible).toBe(true);
    }
  );

  it('should return false when not in session and configuration is set to true for that session', () => {
    vi.mocked(useCurrentSessionType).mockReturnValue('Practice');

    const visible = useSessionVisibility({
      sessionVisibility: {
        race: true,
        loneQualify: false,
        openQualify: false,
        practice: false,
        offlineTesting: false,
      },
    });

    expect(visible).toBe(false);
  });

  it('should return false when in session and configuration is set to false for that session', () => {
    vi.mocked(useCurrentSessionType).mockReturnValue('Race');

    const visible = useSessionVisibility({
      sessionVisibility: {
        race: false,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });

    expect(visible).toBe(false);
  });
});
