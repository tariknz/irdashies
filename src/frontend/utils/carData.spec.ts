import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCarData, getGearKey, fetchCarList } from './carData';

// Mock fetch and localStorage
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('carData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
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
      // First attempt with original fails, second with lowercase succeeds
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
        'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/test-car_123.json'
      );
    });

    it('handles car paths with spaces (MX-5 case)', async () => {
      // First attempt succeeds with encoded space
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCarData)
        });

      const result = await loadCarData('mx5 mx52016');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenNthCalledWith(1,
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

    it('caches car data and returns from cache on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCarData)
      });

      // First call should fetch from API
      const result1 = await loadCarData('testcar');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should return from cache without fetching
      const result2 = await loadCarData('testcar');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result1).toEqual(result2);
    });

    it('caches results separately for different games', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCarData)
      });

      // Call for IRacing
      await loadCarData('testcar', 'iracing');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Call for different game should fetch again
      await loadCarData('testcar', 'assettocorsa');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchCarList', () => {
    const mockCarList = [
      { name: 'car1.json', path: 'data/IRacing/car1.json' },
      { name: 'car2.json', path: 'data/IRacing/car2.json' }
    ];

    it('fetches car list from GitHub API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: () => Promise.resolve(mockCarList)
      });

      const result = await fetchCarList('IRacing');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/Lovely-Sim-Racing/lovely-car-data/contents/data/IRacing'
      );
      expect(result).toEqual(mockCarList);
    });

    it('caches car list and returns from cache on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: () => Promise.resolve(mockCarList)
      });

      // First call should fetch from API
      const result1 = await fetchCarList('IRacing');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should return from cache without fetching
      const result2 = await fetchCarList('IRacing');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result1).toEqual(result2);
    });

    it('throws helpful error on rate limit', async () => {
      const rateLimitReset = Math.floor(Date.now() / 1000) + 3600;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map([['X-RateLimit-Reset', rateLimitReset.toString()]])
      });

      await expect(fetchCarList('IRacing')).rejects.toThrow('GitHub API rate limit exceeded');
    });

    it('throws error on other API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      });

      await expect(fetchCarList('IRacing')).rejects.toThrow('GitHub API error');
    });

    it('caches results separately for different games', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        json: () => Promise.resolve(mockCarList)
      });

      // Call for IRacing
      await fetchCarList('IRacing');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Call for different game should fetch again
      await fetchCarList('F12025');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});