import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSessionProfileMap,
  setSessionProfileMap,
  initialiseSessionProfileMap,
} from './appSettings';
import { SESSION_PROFILE_KEYS } from '@irdashies/types';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

const KEY = 'sessionProfileMap';

describe('session profile map', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
  });

  describe('initialiseSessionProfileMap', () => {
    it('points every session type at the profile in use on a first run', () => {
      mockReadData.mockReturnValue(undefined);

      const seeded = initialiseSessionProfileMap('race-layout');

      for (const key of SESSION_PROFILE_KEYS) {
        expect(seeded[key]).toBe('race-layout');
      }
      expect(mockWriteData).toHaveBeenCalledWith(KEY, seeded);
    });

    it('leaves spotting unset, so stepping out of the car changes nothing', () => {
      mockReadData.mockReturnValue(undefined);

      const seeded = initialiseSessionProfileMap('race-layout');

      expect(seeded.spotting).toBeUndefined();
    });

    it('does not re-seed once a mapping has been stored', () => {
      mockReadData.mockReturnValue({ race: 'chosen-by-user' });

      const result = initialiseSessionProfileMap('some-other-profile');

      expect(result).toEqual({ race: 'chosen-by-user' });
      expect(mockWriteData).not.toHaveBeenCalled();
    });

    it('respects a map the user has deliberately emptied', () => {
      // An empty object is a decision — every row set back to "Don't switch" —
      // and must not be mistaken for "never configured".
      mockReadData.mockReturnValue({});

      const result = initialiseSessionProfileMap('race-layout');

      expect(result).toEqual({});
      expect(mockWriteData).not.toHaveBeenCalled();
    });

    it('seeds a no-op: every session resolves to the active profile', () => {
      mockReadData.mockReturnValue(undefined);

      const seeded = initialiseSessionProfileMap('current');

      // Nothing can switch while every value is the profile already in use,
      // which is what makes seeding safe to do without asking.
      expect(new Set(Object.values(seeded))).toEqual(new Set(['current']));
    });
  });

  describe('get and set', () => {
    it('reads back what was stored', () => {
      mockReadData.mockReturnValue({ race: 'race-layout' });
      expect(getSessionProfileMap()).toEqual({ race: 'race-layout' });
    });

    it('reports an unconfigured map as empty', () => {
      mockReadData.mockReturnValue(undefined);
      expect(getSessionProfileMap()).toEqual({});
    });

    it('persists a map under the settings key', () => {
      setSessionProfileMap({ practice: 'a', spotting: 'b' });
      expect(mockWriteData).toHaveBeenCalledWith(KEY, {
        practice: 'a',
        spotting: 'b',
      });
    });
  });
});
