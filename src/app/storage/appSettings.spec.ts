import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSessionProfileMap, setSessionProfileMap } from './appSettings';

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

  /**
   * Reading must never write. An earlier version seeded every session type with
   * the profile in use on first run, which is only a no-op while that profile
   * stays active: pick another by hand without ever opening the feature and the
   * next session transition drags you back. Nothing here may map a trigger the
   * user has not mapped themselves.
   */
  describe('an install that has never configured the feature', () => {
    it('maps nothing, so no session transition switches a profile', () => {
      mockReadData.mockReturnValue(undefined);

      expect(getSessionProfileMap()).toEqual({});
    });

    it('does not write anything on being read', () => {
      mockReadData.mockReturnValue(undefined);

      getSessionProfileMap();

      expect(mockWriteData).not.toHaveBeenCalled();
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
