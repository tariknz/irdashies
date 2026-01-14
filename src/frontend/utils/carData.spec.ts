import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCarData, getGearKey } from './carData';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('carData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGearKey', () => {
    it('returns "N" for gear 0', () => {
      expect(getGearKey(0)).toBe('N');
    });

    it('returns "R" for gear -1', () => {
      expect(getGearKey(-1)).toBe('R');
    });

    it('returns string number for positive gears', () => {
      expect(getGearKey(1)).toBe('1');
      expect(getGearKey(2)).toBe('2');
      expect(getGearKey(6)).toBe('6');
    });
  });

  describe('loadCarData', () => {
    const mockCarData = {
      carName: 'Test Car',
      carId: 'testcar',
      carClass: 'GT3',
      ledNumber: 6,
      redlineBlinkInterval: 250,
      ledColor: ['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000'],
      ledRpm: [{
        'R': [7500, 4500, 5000, 5500, 6000, 6500, 7000],
        'N': [7500, 4500, 5000, 5500, 6000, 6500, 7000],
        '1': [7360, 6760, 6860, 6960, 7060, 7160, 7260]
      }]
    };

    it('loads car data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCarData)
      });

      const result = await loadCarData('testcar');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/testcar.json'
      );
      expect(result).toEqual(mockCarData);
    });

    it('loads car data for different games', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCarData)
      });

      const result = await loadCarData('testcar', 'assettocorsacompetizione');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/AssettoCorsaCompetizione/testcar.json'
      );
      expect(result).toEqual(mockCarData);
    });

    it('handles fetch failure gracefully', async () => {
      // All attempts fail
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await loadCarData('nonexistentcar');
      
      expect(result).toBeNull();
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await loadCarData('testcar');
      
      expect(result).toBeNull();
    });

    it('sanitizes car path correctly', async () => {
      // First attempt with original fails, second with sanitized succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCarData)
        });

      await loadCarData('test-car_123');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/test-car_123.json'
      );
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/testcar123.json'
      );
    });

    it('handles car paths with spaces (MX-5 case)', async () => {
      // First two attempts fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCarData)
        });

      const result = await loadCarData('mx5 mx52016');
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/mx5%20mx52016.json'
      );
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/mx5mx52016.json'
      );
      expect(mockFetch).toHaveBeenNthCalledWith(3,
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/mx5%20mx52016.json'
      );
      expect(result).toEqual(mockCarData);
    });

    it('falls back to IRacing for unknown games', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCarData)
      });

      await loadCarData('testcar', 'unknowngame');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/testcar.json'
      );
    });
  });
});