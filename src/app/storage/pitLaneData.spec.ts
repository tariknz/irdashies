import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readPitLaneData,
  updatePitLaneDataForTrack,
  getPitLaneDataForTrack,
} from './pitLaneData';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());

// Mock fs module
vi.mock('node:fs', () => ({
  default: {
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    existsSync: vi.fn(() => true),
  },
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(() => true),
}));

describe('pitLaneData', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockReadData.mockReturnValue(null);
    // Default: return empty object (no data)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  describe('readPitLaneData', () => {
    it('should return empty object if no data exists', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const data = readPitLaneData();

      expect(data).toEqual({});
    });

    it('should return existing pit lane data', () => {
      const pitData = {
        '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
        '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(pitData));

      const data = readPitLaneData();

      expect(data).toEqual(pitData);
    });
  });

  describe('getPitLaneDataForTrack', () => {
    it('should return null if track has no data', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      const data = getPitLaneDataForTrack('47');

      expect(data).toBeNull();
    });

    it('should return pit lane data for specific track', () => {
      const pitData = {
        '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
        '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(pitData));

      const data = getPitLaneDataForTrack('47');

      expect(data).toEqual({ pitEntryPct: 0.92, pitExitPct: 0.05 });
    });

    it('should return partial data if only one value exists', () => {
      const pitData = {
        '47': { pitEntryPct: 0.92, pitExitPct: null },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(pitData));

      const data = getPitLaneDataForTrack('47');

      expect(data).toEqual({ pitEntryPct: 0.92, pitExitPct: null });
    });
  });

  describe('updatePitLaneDataForTrack', () => {
    it('should create new entry for track with no existing data', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      updatePitLaneDataForTrack('47', { pitEntryPct: 0.92 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('pitLaneData.json'),
        JSON.stringify({ '47': { pitEntryPct: 0.92, pitExitPct: null } }, null, 2)
      );
    });

    it('should update existing track data and preserve other tracks', () => {
      const existingData = {
        '47': { pitEntryPct: 0.92, pitExitPct: null },
        '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(existingData));

      updatePitLaneDataForTrack('47', { pitExitPct: 0.05 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('pitLaneData.json'),
        JSON.stringify({
          '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
          '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
        }, null, 2)
      );
    });

    it('should handle partial updates', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '47': { pitEntryPct: null, pitExitPct: 0.05 },
      }));

      updatePitLaneDataForTrack('47', { pitEntryPct: 0.92 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('pitLaneData.json'),
        JSON.stringify({ '47': { pitEntryPct: 0.92, pitExitPct: 0.05 } }, null, 2)
      );
    });

    it('should update both values at once', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      updatePitLaneDataForTrack('47', { pitEntryPct: 0.92, pitExitPct: 0.05 });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('pitLaneData.json'),
        JSON.stringify({ '47': { pitEntryPct: 0.92, pitExitPct: 0.05 } }, null, 2)
      );
    });

    it('should allow null values to be set', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
      }));

      updatePitLaneDataForTrack('47', { pitEntryPct: null });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('pitLaneData.json'),
        JSON.stringify({ '47': { pitEntryPct: null, pitExitPct: 0.05 } }, null, 2)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle track with only entry data', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      updatePitLaneDataForTrack('47', { pitEntryPct: 0.92 });

      // Verify writeFileSync was called
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should handle track with only exit data', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      updatePitLaneDataForTrack('47', { pitExitPct: 0.05 });

      // Verify writeFileSync was called
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should handle multiple tracks', () => {
      const data = {
        '47': { pitEntryPct: 0.92, pitExitPct: 0.05 },
        '181': { pitEntryPct: 0.9869, pitExitPct: 0.0683 },
        '321': { pitEntryPct: 0.50, pitExitPct: null },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(data));

      const data47 = getPitLaneDataForTrack('47');
      const data181 = getPitLaneDataForTrack('181');
      const data321 = getPitLaneDataForTrack('321');

      expect(data47).toEqual({ pitEntryPct: 0.92, pitExitPct: 0.05 });
      expect(data181).toEqual({ pitEntryPct: 0.9869, pitExitPct: 0.0683 });
      expect(data321).toEqual({ pitEntryPct: 0.50, pitExitPct: null });
    });
  });
});
