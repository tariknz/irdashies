import { describe, expect, it } from 'vitest';
import { drawnRoadLateral, isBesideUs, roadLateral } from './radarDraw';

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

describe('drawnRoadLateral', () => {
  it('keeps the formation offset on the drawn track', () => {
    expect(drawnRoadLateral(false, 0.5, 2.6)).toBeCloseTo(-1.3);
  });

  it('adds no offset when the map frame already places the road', () => {
    expect(drawnRoadLateral(true, 0.5, 2.6)).toBe(0);
  });
});

describe('isBesideUs', () => {
  it('keeps a car without a measured offset, and a measured one within 10 m', () => {
    expect(isBesideUs(undefined)).toBe(true);
    expect(isBesideUs(-3)).toBe(true);
    expect(isBesideUs(10)).toBe(true);
  });

  it('leaves out a measured car further to the side, which gets no warning or dive hint', () => {
    expect(isBesideUs(12)).toBe(false);
    expect(isBesideUs(-200)).toBe(false);
  });
});
