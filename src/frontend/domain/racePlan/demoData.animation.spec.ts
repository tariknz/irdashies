import { describe, expect, it } from 'vitest';
import {
  getDemoRacePlanSnapshot,
  getDemoStrategyTimelineSnapshot,
} from './demoData';

describe('animated race-plan demos', () => {
  it('advances stint laps and drift over time', () => {
    const a = getDemoRacePlanSnapshot(0);
    const b = getDemoRacePlanSnapshot(40);
    expect(a.lapsInStint).not.toBe(b.lapsInStint);
    expect(a.driftSec).not.toBe(b.driftSec);
  });

  it('keeps a repair stop on the strategy timeline snapshot', () => {
    const snapshot = getDemoStrategyTimelineSnapshot(12);
    expect(snapshot.stops.length).toBeGreaterThan(0);
    expect(snapshot.stints.some((stint) => stint.rebuilt)).toBe(true);
  });
});
