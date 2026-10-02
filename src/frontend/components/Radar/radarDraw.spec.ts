import { describe, expect, it } from 'vitest';
import { warningLevel } from './radarDraw';

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
