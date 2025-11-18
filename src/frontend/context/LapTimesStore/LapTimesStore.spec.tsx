import { describe, it, expect, beforeEach } from 'vitest';
import { useLapTimesStore } from './LapTimesStore';

describe('LapTimesStore', () => {
  beforeEach(() => {
    useLapTimesStore.setState({
      lapTimeBuffer: null,
      lapTimes: [],
    });
  });

  it('should have initial state', () => {
    const state = useLapTimesStore.getState();
    expect(state.lapTimes).toEqual([]);
    expect(state.lapTimeBuffer).toBeNull();
  });

  it('should set lapTimes to empty if no lap times', () => {
    useLapTimesStore.getState().updateLapTimes([]);
    expect(useLapTimesStore.getState().lapTimes).toEqual([]);
  });

  it('should use first lap time directly', () => {
    // First call: should use the lap time directly
    useLapTimesStore.getState().updateLapTimes([90.5]);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.5, 3);

    // Second call: same lap time, should still show the same value
    useLapTimesStore.getState().updateLapTimes([90.5]);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.5, 3);

    // Third call: new lap time, should start calculating pace
    useLapTimesStore.getState().updateLapTimes([89.8]);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.15, 3);
  });

  it('should ignore invalid lap times', () => {
    useLapTimesStore.getState().updateLapTimes([90.5]);
    useLapTimesStore.getState().updateLapTimes([0]); // Invalid lap time
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.5, 3);
  });

  it('should ignore unchanged lap times', () => {
    useLapTimesStore.getState().updateLapTimes([90.5]);
    useLapTimesStore.getState().updateLapTimes([90.5]); // Same lap time
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.5, 3);
  });

  it('should filter outliers and use median for pace', () => {
    // Fill up the window with lap times including an outlier
    const lapTimes = [90.5, 89.8, 120.0, 90.2, 89.9]; // 120.0 is an outlier
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time]);
    });

    // The pace should be the median of the non-outlier times
    // After filtering outliers, we have [89.8, 89.9, 90.2, 90.5]
    // The median of these values is (89.9 + 90.2) / 2 = 90.05
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.05, 3);
  });

  it('should handle multiple cars with outliers', () => {
    // First call: should use lap times directly
    useLapTimesStore.getState().updateLapTimes([90.5, 91.2]);
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.5, 3);
    expect(useLapTimesStore.getState().lapTimes[1]).toBeCloseTo(91.2, 3);

    // Add some lap times including outliers
    useLapTimesStore.getState().updateLapTimes([89.8, 120.0]); // 120.0 is an outlier
    useLapTimesStore.getState().updateLapTimes([90.2, 91.0]);
    useLapTimesStore.getState().updateLapTimes([89.9, 91.1]);
    useLapTimesStore.getState().updateLapTimes([90.1, 91.3]);

    // Car 1: After filtering, we have [89.8, 89.9, 90.1, 90.2, 90.5]
    // With 5 values, median is the middle value: 90.1
    // Car 2: After filtering, we have [91.0, 91.1, 91.2, 91.3]
    // Median is (91.1 + 91.2) / 2 = 91.15
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.1, 3);
    expect(useLapTimesStore.getState().lapTimes[1]).toBeCloseTo(91.15, 3);
  });

  it('should handle multiple outliers in sequence', () => {
    // First call: should use lap time directly
    useLapTimesStore.getState().updateLapTimes([90.5]);
    
    // Add a series of laps with multiple outliers
    const lapTimes = [120.0, 90.2, 150.0, 89.9, 90.1]; // Two outliers: 120.0 and 150.0
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time]);
    });

    // The pace should be the median of the non-outlier times
    // After filtering outliers, we have [89.9, 90.1, 90.2, 90.5]
    // The median of these values is (90.1 + 90.2) / 2 = 90.15
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(90.15, 3);
  });

  it('should handle rapid lap time changes', () => {
    // First call: should use lap time directly
    useLapTimesStore.getState().updateLapTimes([90.5]);
    
    // Add a series of laps with rapid changes
    const lapTimes = [89.0, 92.0, 88.5, 91.5, 89.5]; // All within reasonable range
    lapTimes.forEach((time) => {
      useLapTimesStore.getState().updateLapTimes([time]);
    });

    // With OUTLIER_THRESHOLD = 1.0, the filtered values are [89.0, 89.5], so the median is 89.25
    expect(useLapTimesStore.getState().lapTimes[0]).toBeCloseTo(89.25, 3);
  });
}); 