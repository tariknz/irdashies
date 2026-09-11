import { describe, it, expect } from 'vitest';
import { garage61LapsUrl } from './LapTraceSettings';

describe('garage61LapsUrl', () => {
  it('builds the lap search for one track and car', () => {
    // The trailing matrix parameters are Garage 61's filter defaults, and are
    // easy to mistype into a URL that silently filters everything out.
    expect(garage61LapsUrl({ trackId: 318, carId: 178 })).toBe(
      'https://garage61.net/app/laps/318/178;a=-1;bw=0,;bp=,0'
    );
  });
});
