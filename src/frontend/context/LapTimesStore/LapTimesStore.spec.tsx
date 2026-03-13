import { describe, it, expect, beforeEach } from 'vitest';
import { useLapTimesStore } from './LapTimesStore';

describe('LapTimesStore', () => {
  beforeEach(() => {
    useLapTimesStore.setState({
      lapTimeBuffer: null,
      lapTimes: [],
      sessionNum: null,
    });
  });

  it('should have initial state', () => {
    const state = useLapTimesStore.getState();
    expect(state.lapTimes).toEqual([]);
    expect(state.lapTimeBuffer).toBeNull();
    expect(state.sessionNum).toBeNull();
  });

  it('should set lapTimes to empty if no lap times', () => {
    useLapTimesStore.getState().updateLapTimes([], 1);
    expect(useLapTimesStore.getState().lapTimes).toEqual([]);
  });

  it('should not add first lap time to history (baseline only)', () => {
    // First call just records baseline, no history yet
    useLapTimesStore.getState().updateLapTimes([90.5], 1);
    expect(
      useLapTimesStore.getState().lapTimeBuffer?.lapTimeHistory[0]
    ).toEqual([]);
    // No history means no average calculated, lapTimes stays empty
    expect(useLapTimesStore.getState().lapTimes).toEqual([]);
  });

  it('should add to history when lap time changes', () => {
    // First call: baseline
    useLapTimesStore.getState().updateLapTimes([90.5], 1);

    // Second call: new lap time, now it gets recorded in history
    useLapTimesStore.getState().updateLapTimes([89.8], 1);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.8, 3);

    // Third call: another new lap time
    useLapTimesStore.getState().updateLapTimes([90.2], 1);
    // Median of [89.8, 90.2] = 90.0
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.0, 3);
  });

  it('should ignore invalid lap times', () => {
    useLapTimesStore.getState().updateLapTimes([90.5], 1);
    useLapTimesStore.getState().updateLapTimes([89.8], 1); // recorded
    useLapTimesStore.getState().updateLapTimes([0], 1); // Invalid lap time
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.8, 3);
  });

  it('should ignore unchanged lap times', () => {
    useLapTimesStore.getState().updateLapTimes([90.5], 1);
    useLapTimesStore.getState().updateLapTimes([90.5], 1); // Same lap time
    // No history recorded yet since value never changed
    expect(
      useLapTimesStore.getState().lapTimeBuffer?.lapTimeHistory[0]
    ).toEqual([]);
  });

  it('should filter outliers and use median for pace', () => {
    // First call: baseline
    useLapTimesStore.getState().updateLapTimes([90.5], 1);

    // Subsequent calls: history grows on each change
    const lapTimes = [89.8, 120.0, 90.2, 89.9]; // 120.0 is an outlier
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time], 1);
    });

    // History: [89.8, 120.0, 90.2, 89.9]
    // After filtering outliers: [89.8, 89.9, 90.2]
    // Median: 89.9
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.9, 3);
  });

  it('should handle multiple cars with outliers', () => {
    // First call: baseline (not added to history)
    useLapTimesStore.getState().updateLapTimes([90.5, 91.2], 1);

    // Add some lap times including outliers
    useLapTimesStore.getState().updateLapTimes([89.8, 120.0], 1);
    useLapTimesStore.getState().updateLapTimes([90.2, 91.0], 1);
    useLapTimesStore.getState().updateLapTimes([89.9, 91.1], 1);
    useLapTimesStore.getState().updateLapTimes([90.1, 91.3], 1);

    // Car 1 history: [89.8, 90.2, 89.9, 90.1]
    // After filtering: [89.8, 89.9, 90.1, 90.2] → median (89.9 + 90.1)/2 = 90.0
    // Car 2 history: [120.0, 91.0, 91.1, 91.3]
    // After filtering: [91.0, 91.1, 91.3] → median 91.1
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.0, 3);
    expect(useLapTimesStore.getState().lapTimes[1]).toBeCloseTo(91.1, 3);
  });

  it('should handle multiple outliers in sequence', () => {
    // First call: baseline
    useLapTimesStore.getState().updateLapTimes([90.5], 1);

    // Add a series of laps with multiple outliers
    const lapTimes = [120.0, 90.2, 150.0, 89.9, 90.1]; // Two outliers
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time], 1);
    });

    // History: [120.0, 90.2, 150.0, 89.9, 90.1]
    // After filtering outliers (150.0 removed): [120.0, 90.2, 89.9, 90.1]
    // Sorted: [89.9, 90.1, 90.2, 120.0], median = (90.1 + 90.2) / 2 = 90.15
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.15, 3);
  });

  it('should handle rapid lap time changes', () => {
    // First call: baseline
    useLapTimesStore.getState().updateLapTimes([90.5], 1);

    // Add a series of laps with rapid changes
    const lapTimes = [89.0, 92.0, 88.5, 91.5, 89.5]; // All within reasonable range
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time], 1);
    });

    // History: [89.0, 92.0, 88.5, 91.5, 89.5]
    // With OUTLIER_THRESHOLD = 1.0, the filtered values are [89.0, 89.5]
    // Median: (89.0 + 89.5) / 2 = 89.25
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.25, 3);
  });

  it('should auto-reset when session changes', () => {
    // Add some lap times in session 1
    useLapTimesStore.getState().updateLapTimes([90.5], 1);
    useLapTimesStore.getState().updateLapTimes([89.8], 1);
    useLapTimesStore.getState().updateLapTimes([90.2], 1);

    // History: [89.8, 90.2], median = 90.0
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.0, 3);
    expect(useLapTimesStore.getState().sessionNum).toBe(1);

    // Session changes to 2 - should auto-reset
    useLapTimesStore.getState().updateLapTimes([85.0], 2);

    expect(useLapTimesStore.getState().sessionNum).toBe(2);
    expect(useLapTimesStore.getState().lapTimes).toEqual([]);
    expect(useLapTimesStore.getState().lapTimeBuffer).toBeNull();
  });

  it('should not record stale data after session change', () => {
    // Session 1: build up some history
    useLapTimesStore.getState().updateLapTimes([90.5], 1);
    useLapTimesStore.getState().updateLapTimes([89.8], 1);

    // Session changes to 2 - resets
    useLapTimesStore.getState().updateLapTimes([89.8], 2);

    // Next call still has stale 89.8 from session 1 - should be baseline only
    useLapTimesStore.getState().updateLapTimes([89.8], 2);
    expect(
      useLapTimesStore.getState().lapTimeBuffer?.lapTimeHistory[0]
    ).toEqual([]);

    // Only when a genuinely new lap time appears should it be recorded
    useLapTimesStore.getState().updateLapTimes([91.0], 2);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(91.0, 3);
  });

  it('should not reset on first session', () => {
    // First update with sessionNum - baseline only
    useLapTimesStore.getState().updateLapTimes([90.5], 1);

    // Buffer should exist with baseline
    expect(useLapTimesStore.getState().lapTimeBuffer).not.toBeNull();
    expect(useLapTimesStore.getState().sessionNum).toBe(1);
  });

  it('should handle null sessionNum gracefully', () => {
    useLapTimesStore.getState().updateLapTimes([90.5], null);
    expect(useLapTimesStore.getState().sessionNum).toBeNull();

    // Switching from null to a number should not trigger reset
    useLapTimesStore.getState().updateLapTimes([89.8], 1);
    // 89.8 is different from baseline 90.5, so it gets recorded
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.8, 3);
    expect(useLapTimesStore.getState().sessionNum).toBe(1);
  });
});
