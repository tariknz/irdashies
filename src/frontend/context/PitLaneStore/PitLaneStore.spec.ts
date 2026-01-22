import { describe, it, expect, beforeEach } from 'vitest';
import { usePitLaneStore, detectPitTransitions } from './PitLaneStore';

describe('PitLaneStore', () => {
  beforeEach(() => {
    // Reset store state and module-level previous frame data before each test
    usePitLaneStore.getState().reset();
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
      });
    });

    it('should detect pit entry when car transitions from track to pit road', () => {
      // First frame: establish previous state (both cars on track)
      detectPitTransitions(
        [false, false], // carIdxOnPitRoad
        [3, 3], // carIdxTrackSurface - both on track
        [0.90, 0.85] // carIdxLapDistPct
      );

      // Second frame: car 0 enters pit road
      detectPitTransitions(
        [true, false], // carIdxOnPitRoad - car 0 now on pit road
        [2, 3], // carIdxTrackSurface - car 0 on pit road surface
        [0.91, 0.86] // carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBe(0.90); // Uses previous frame position
    });

    it('should NOT detect pit entry when car leaves pitbox (surface 1→2)', () => {
      // First frame: car in pitbox
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [1], // carIdxTrackSurface - in pitbox
        [0.93] // carIdxLapDistPct
      );

      // Second frame: car leaving pitbox onto pit road
      detectPitTransitions(
        [true], // carIdxOnPitRoad - now true
        [2], // carIdxTrackSurface - now on pit road
        [0.93] // carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull(); // Should not be detected
    });

    it('should skip detection when both positions are wrapped (< 20%)', () => {
      // First frame: car on track at low position
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [3], // carIdxTrackSurface - on track
        [0.10] // carIdxLapDistPct - low position
      );

      // Second frame: car enters pit at still low position (wrapped)
      detectPitTransitions(
        [true], // carIdxOnPitRoad
        [2], // carIdxTrackSurface - on pit road
        [0.12] // carIdxLapDistPct - still low position
      );

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull(); // Should skip wrapped positions
    });

    it('should handle wrap-around at start/finish line', () => {
      // First frame: car on track near end of lap
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [3], // carIdxTrackSurface - on track
        [0.99] // carIdxLapDistPct - near end of lap
      );

      // Second frame: car enters pit still at high position
      detectPitTransitions(
        [true], // carIdxOnPitRoad
        [2], // carIdxTrackSurface - on pit road
        [0.995] // carIdxLapDistPct - still high position
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
      });
    });

    it('should detect pit exit when car transitions from pit road to track', () => {
      // First frame: car on pit road
      detectPitTransitions(
        [true], // carIdxOnPitRoad
        [2], // carIdxTrackSurface - on pit road
        [0.04] // carIdxLapDistPct
      );

      // Second frame: car exits pit road
      detectPitTransitions(
        [false], // carIdxOnPitRoad - now false
        [2], // carIdxTrackSurface - still surface 2 (pit exit road)
        [0.05] // carIdxLapDistPct
      );

      const state = usePitLaneStore.getState();
      expect(state.pitExitPct).toBe(0.05); // Uses current position
    });

    it('should only detect once per track', () => {
      // First car pit exit: establish previous frame
      detectPitTransitions(
        [true], // carIdxOnPitRoad
        [2], // carIdxTrackSurface
        [0.04] // carIdxLapDistPct
      );

      // First car pit exit: detect transition
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [2], // carIdxTrackSurface
        [0.05] // carIdxLapDistPct
      );

      expect(usePitLaneStore.getState().pitExitPct).toBe(0.05);

      // Try to detect again with different car (second car)
      // Establish previous frame with car 0 on track, car 1 on pit road
      detectPitTransitions(
        [false, true], // carIdxOnPitRoad
        [3, 2], // carIdxTrackSurface
        [0.10, 0.04] // carIdxLapDistPct
      );

      // Second car pit exit
      detectPitTransitions(
        [false, false], // carIdxOnPitRoad - car 1 now exits
        [3, 2], // carIdxTrackSurface
        [0.11, 0.06] // carIdxLapDistPct
      );

      // Should still be the first detected value (first detection wins)
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

      detectPitTransitions([], [], []);

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull();
      expect(state.pitExitPct).toBeNull();
    });

    it('should handle missing telemetry values gracefully', () => {
      usePitLaneStore.setState({
        currentTrackId: '47',
      });

      // Establish a previous frame
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [3], // carIdxTrackSurface
        [0.50] // carIdxLapDistPct
      );

      // Pass empty arrays (simulating missing telemetry)
      detectPitTransitions([], [], []);

      const state = usePitLaneStore.getState();
      expect(state.pitEntryPct).toBeNull();
      expect(state.pitExitPct).toBeNull();
    });

    it('should detect pit entry even with NotInWorld previous surface', () => {
      usePitLaneStore.setState({
        currentTrackId: '47',
        pitEntryPct: null,
      });

      // First frame: car not in world (spectating or loading)
      detectPitTransitions(
        [false], // carIdxOnPitRoad
        [-1], // carIdxTrackSurface - NotInWorld
        [0.50] // carIdxLapDistPct
      );

      // Second frame: car enters pit road
      detectPitTransitions(
        [true], // carIdxOnPitRoad
        [2], // carIdxTrackSurface - on pit road
        [0.51] // carIdxLapDistPct
      );

      // Should detect because NotInWorld is not InPitStall
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.50);
    });
  });
});
