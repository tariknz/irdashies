import { describe, expect, it } from 'vitest';
import { followLineEnds, warningLevel } from './radarDraw';

describe('warningLevel', () => {
  // Two 4.6 m cars: bodies overlap while the centres are within 4.6 m.
  it('is alongside while the bodies overlap along the track', () => {
    expect(warningLevel(0, 4.6, 4.6, 7)).toBe('alongside');
    expect(warningLevel(-4.5, 4.6, 4.6, 7)).toBe('alongside');
  });

  it('is close inside the caution gap, either way round', () => {
    expect(warningLevel(10, 4.6, 4.6, 7)).toBe('close');
    expect(warningLevel(-11.5, 4.6, 4.6, 7)).toBe('close');
  });

  it('is nothing beyond the caution gap', () => {
    expect(warningLevel(12, 4.6, 4.6, 7)).toBe('none');
  });

  it('measures the gap between two different bodies', () => {
    // A 5.2 m stock car and a 4.0 m MX-5: overlap ends at 4.6 m.
    expect(warningLevel(4.5, 5.2, 4.0, 7)).toBe('alongside');
    expect(warningLevel(4.7, 5.2, 4.0, 7)).toBe('close');
  });
});

describe('followLineEnds', () => {
  it('runs from the nose of our car to the tail of the one ahead', () => {
    const ends = followLineEnds({ x: 100, y: 100 }, { x: 100, y: 20 }, 10, 12);
    expect(ends).toEqual({ x1: 100, y1: 90, x2: 100, y2: 32 });
  });

  it('follows a car off to the side', () => {
    const ends = followLineEnds({ x: 0, y: 0 }, { x: 30, y: -40 }, 5, 5);
    expect(ends?.x1).toBeCloseTo(3, 5);
    expect(ends?.y1).toBeCloseTo(-4, 5);
    expect(ends?.x2).toBeCloseTo(27, 5);
    expect(ends?.y2).toBeCloseTo(-36, 5);
  });

  it('draws nothing when the cars nearly touch', () => {
    expect(followLineEnds({ x: 0, y: 0 }, { x: 0, y: -20 }, 10, 10)).toBeNull();
  });
});
