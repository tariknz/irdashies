import { describe, expect, it } from 'vitest';
import { getDemoStintLaps } from './stintHistoryDemo';
import { groupStints } from './logic';

describe('getDemoStintLaps', () => {
  it('groups into stints that advance over time', () => {
    const early = groupStints(getDemoStintLaps(0));
    const later = groupStints(getDemoStintLaps(40));
    expect(early.length).toBeGreaterThan(0);
    expect(early[0].firstLap).toBeLessThan(later[0].firstLap);
  });
});
