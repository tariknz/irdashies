import { describe, expect, it } from 'vitest';
import { calculateIRatingGain, RaceResult } from './iratingGain';

interface Driver {
  idx: number;
}

describe('calculateIRatingGain', () => {
  it('should match the sample data results', () => {
    // Sample data from sample.ts
    const sampleData: RaceResult<Driver>[] = [
      { driver: { idx: 0 }, finishRank: 1, startIRating: 2502, started: true },
      { driver: { idx: 1 }, finishRank: 2, startIRating: 1202, started: true },
      { driver: { idx: 2 }, finishRank: 3, startIRating: 1585, started: true },
      { driver: { idx: 3 }, finishRank: 4, startIRating: 1409, started: true },
      { driver: { idx: 4 }, finishRank: 5, startIRating: 1531, started: true },
      { driver: { idx: 5 }, finishRank: 6, startIRating: 967, started: true },
      { driver: { idx: 6 }, finishRank: 7, startIRating: 1016, started: true },
      { driver: { idx: 7 }, finishRank: 8, startIRating: 459, started: true },
      { driver: { idx: 8 }, finishRank: 9, startIRating: 770, started: true },
      { driver: { idx: 9 }, finishRank: 10, startIRating: 926, started: true },
      { driver: { idx: 10 }, finishRank: 11, startIRating: 815, started: false },
      { driver: { idx: 11 }, finishRank: 12, startIRating: 1518, started: false }
    ];

    const results = calculateIRatingGain(sampleData);

    // Expected results from sample.ts
    const expectedResults = [
      { idx: 0, iratingChange: 51.526181519664114 },
      { idx: 1, iratingChange: 85.93706251432899 },
      { idx: 2, iratingChange: 45.76839250350699 },
      { idx: 3, iratingChange: 34.726798295045704 },
      { idx: 4, iratingChange: 8.75717685896802 },
      { idx: 5, iratingChange: 22.00892280681238 },
      { idx: 6, iratingChange: -1.1847185527524153 },
      { idx: 7, iratingChange: 26.417252365382087 },
      { idx: 8, iratingChange: -22.43830479379796 },
      { idx: 9, iratingChange: -54.257888044345336 },
      { idx: 10, iratingChange: -78.76773919166914 },
      { idx: 11, iratingChange: -118.49313628114338 }
    ];

    // Compare results with expected values
    results.forEach((result, index) => {
      const expected = expectedResults[index];
      expect(result.iratingChange).toBe(expected.iratingChange);
      expect(result.raceResult.driver.idx).toBe(expected.idx);
    });
  });
}); 
