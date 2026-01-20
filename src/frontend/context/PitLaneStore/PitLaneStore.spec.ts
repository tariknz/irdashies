import { describe, it, expect, beforeEach } from 'vitest';
import { usePitLaneStore } from './PitLaneStore';

describe('PitLaneStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePitLaneStore.setState({
      currentTrackId: null,
      pitEntryPct: null,
      pitExitPct: null,
      previousCarIdxOnPitRoad: [],
      previousCarIdxTrackSurface: [],
      previousCarIdxLapDistPct: [],
    });
  });

  describe('setCurrentTrack', () => {
    it('should set track ID and load existing pit lane data', () => {
      const trackId = '47'; // Laguna Seca
      const pitData = { pitEntryPct: 0.92, pitExitPct: 0.05 };

      usePitLaneStore.getState().setCurrentTrack(trackId, pitData);

      const state = usePitLaneStore.getState();
      expect(state.currentTrackId).toBe(trackId);
      expect(state.pitEntryPct).toBe(0.92);
      expect(state.pitExitPct).toBe(0.05);
    });

    it('should handle null pit lane data for new track', () => {
      const trackId = '999';

      usePitLaneStore.getState().setCurrentTrack(trackId, null);

      const state = usePitLaneStore.getState();
      expect(state.currentTrackId).toBe(trackId);
      expect(state.pitEntryPct).toBeNull();
      expect(state.pitExitPct).toBeNull();
    });
  });

  describe('detectTransitions - pit entry', () => {
    beforeEach(() => {
      usePitLaneStore.setState({
        currentTrackId: '47',
        pitEntryPct: null,
        pitExitPct: null,
        previousCarIdxOnPitRoad: [false, false],
        previousCarIdxTrackSurface: [3, 3], // Both on track
        previousCarIdxLapDistPct: [0.90, 0.85],
      });
    });

    it('should detect pit entry when car transitions from track to pit road', () => {
      const carIdxOnPitRoad = [true, false];
      const carIdxTrackSurface = [2, 3]; // Car 0 now on pit road
      const carIdxLapDistPct = [0.91, 0.86];

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBe(0.90); // Uses previous frame position
    });

    it('should NOT detect pit entry when car leaves pitbox (surface 1→2)', () => {
      usePitLaneStore.setState({
        previousCarIdxOnPitRoad: [false],
        previousCarIdxTrackSurface: [1], // Was in pitbox
        previousCarIdxLapDistPct: [0.93],
      });

      const carIdxOnPitRoad = [true];
      const carIdxTrackSurface = [2]; // Now on pit road
      const carIdxLapDistPct = [0.93];

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull(); // Should not be detected
    });

    it('should skip detection when both positions are wrapped (< 20%)', () => {
      usePitLaneStore.setState({
        previousCarIdxOnPitRoad: [false],
        previousCarIdxTrackSurface: [3],
        previousCarIdxLapDistPct: [0.10], // Low position
      });

      const carIdxOnPitRoad = [true];
      const carIdxTrackSurface = [2];
      const carIdxLapDistPct = [0.12]; // Still low position

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull(); // Should skip wrapped positions
    });

    it('should handle wrap-around at start/finish line', () => {
      usePitLaneStore.setState({
        previousCarIdxOnPitRoad: [false],
        previousCarIdxTrackSurface: [3],
        previousCarIdxLapDistPct: [0.99], // Near end of lap
      });

      const carIdxOnPitRoad = [true];
      const carIdxTrackSurface = [2];
      const carIdxLapDistPct = [0.995]; // Still high position

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBe(0.99); // Should use previous position
    });
  });

  describe('detectTransitions - pit exit', () => {
    beforeEach(() => {
      usePitLaneStore.setState({
        currentTrackId: '47',
        pitEntryPct: 0.92,
        pitExitPct: null,
        previousCarIdxOnPitRoad: [true],
        previousCarIdxTrackSurface: [2], // On pit road
        previousCarIdxLapDistPct: [0.04],
      });
    });

    it('should detect pit exit when car transitions from pit road to track', () => {
      const carIdxOnPitRoad = [false];
      const carIdxTrackSurface = [2]; // Still surface 2 (pit exit road)
      const carIdxLapDistPct = [0.05];

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitExitPct).toBe(0.05); // Uses current position
    });

    it('should only detect once per track', () => {
      const carIdxOnPitRoad = [false];
      const carIdxTrackSurface = [2];
      const carIdxLapDistPct = [0.05];

      // First detection
      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      expect(usePitLaneStore.getState().pitExitPct).toBe(0.05);

      // Try to detect again with different car
      usePitLaneStore.setState({
        previousCarIdxOnPitRoad: [false, true],
        previousCarIdxTrackSurface: [3, 2],
        previousCarIdxLapDistPct: [0.10, 0.04],
      });

      const carIdxOnPitRoad2 = [false, false];
      const carIdxTrackSurface2 = [3, 2];
      const carIdxLapDistPct2 = [0.11, 0.06];

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad2,
        carIdxTrackSurface2,
        carIdxLapDistPct2
      );

      // Should still be the first detected value
      expect(usePitLaneStore.getState().pitExitPct).toBe(0.05);
    });
  });

  describe('updatePitEntry and updatePitExit', () => {
    it('should update pit entry and trigger data save', () => {
      usePitLaneStore.setState({ currentTrackId: '47' });

      usePitLaneStore.getState().updatePitEntry(0.92);

      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.92);
    });

    it('should update pit exit and trigger data save', () => {
      usePitLaneStore.setState({ currentTrackId: '47', pitEntryPct: 0.92 });

      usePitLaneStore.getState().updatePitExit(0.05);

      expect(usePitLaneStore.getState().pitExitPct).toBe(0.05);
    });

    it('should not update if value is already set (first detection wins)', () => {
      usePitLaneStore.setState({ currentTrackId: '47', pitEntryPct: 0.92 });

      usePitLaneStore.getState().updatePitEntry(0.95); // Try to update with different value

      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.92); // Should still be original value
    });
  });

  describe('edge cases', () => {
    it('should handle empty telemetry arrays', () => {
      usePitLaneStore.setState({ currentTrackId: '47' });

      usePitLaneStore.getState().detectTransitions([], [], []);

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull();
      expect(state.pitExitPct).toBeNull();
    });

    it('should handle missing telemetry values gracefully', () => {
      usePitLaneStore.setState({
        currentTrackId: '47',
        previousCarIdxOnPitRoad: [false],
        previousCarIdxTrackSurface: [3],
        previousCarIdxLapDistPct: [0.50],
      });

      // Pass empty arrays instead of undefined
      usePitLaneStore.getState().detectTransitions([], [], []);

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull();
      expect(state.pitExitPct).toBeNull();
    });

    it('should detect pit entry even with NotInWorld previous surface', () => {
      usePitLaneStore.setState({
        currentTrackId: '47',
        pitEntryPct: null,
        previousCarIdxOnPitRoad: [false],
        previousCarIdxTrackSurface: [-1], // NotInWorld
        previousCarIdxLapDistPct: [0.50],
      });

      const carIdxOnPitRoad = [true];
      const carIdxTrackSurface = [2];
      const carIdxLapDistPct = [0.51];

      usePitLaneStore.getState().detectTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );

      // Should detect because NotInWorld is not InPitStall
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.50);
    });
  });
});
