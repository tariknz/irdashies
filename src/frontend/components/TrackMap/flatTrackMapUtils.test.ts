import { describe, it, expect } from 'vitest';
import { progressToPathIndex } from './flatTrackMapUtils';

describe('flatTrackMapUtils', () => {
  describe('progressToPathIndex', () => {
    it('should map 0 progress to index 0', () => {
      expect(progressToPathIndex(0, 100)).toBe(0);
    });

    it('should map 1 progress to last index', () => {
      expect(progressToPathIndex(1, 100)).toBe(99);
    });

    it('should map 0.5 progress to middle index', () => {
      expect(progressToPathIndex(0.5, 100)).toBe(50);
    });

    it('should handle single point path', () => {
      expect(progressToPathIndex(0.5, 1)).toBe(0);
    });
  });
});
