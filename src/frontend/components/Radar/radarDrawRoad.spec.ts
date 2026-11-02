import { describe, expect, it } from 'vitest';
import { roadLateral } from './radarDraw';

describe('roadLateral', () => {
  it('is centred on us outside a formation', () => {
    expect(roadLateral(0, 2.6)).toBe(-0);
  });

  it('puts a road lying to our right on the negative (right) side', () => {
    // Lateral is positive to the left, a lane count positive to the right.
    expect(roadLateral(0.5, 2.6)).toBeCloseTo(-1.3);
    expect(roadLateral(-0.5, 2.6)).toBeCloseTo(1.3);
  });
});
