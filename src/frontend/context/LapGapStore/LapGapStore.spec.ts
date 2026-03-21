import { describe, it, expect, beforeEach } from 'vitest';
import { useLapGapStore } from './LapGapStore';

describe('LapGapStore', () => {
  beforeEach(() => {
    useLapGapStore.getState().reset();
  });

  it('records gap snapshot when lap increments for a car', () => {
    const { recordLapGap } = useLapGapStore.getState();
    recordLapGap(0, 3, 0); // car 0, lap 3 completed, 0s gap (leader)
    recordLapGap(1, 3, 4.2); // car 1, lap 3 completed, 4.2s gap
    const gaps = useLapGapStore.getState().lapGaps;
    expect(gaps[0][3]).toBe(0);
    expect(gaps[1][3]).toBe(4.2);
  });

  it('resets all gaps on session change', () => {
    useLapGapStore.getState().recordLapGap(0, 3, 0);
    useLapGapStore.getState().reset();
    expect(useLapGapStore.getState().lapGaps).toEqual({});
  });
});
