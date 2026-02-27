import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReferenceLapStore, normalizeKey } from './ReferenceLapStore';
import { TRACK_SURFACES } from '../../components/Standings/relativeGapHelpers';
import { precomputePCHIPTangents } from '../../components/Standings/splineInterpolation';
import {
  ReferenceLap,
  ReferenceLapBridge,
  ReferencePoint,
} from '@irdashies/types';
// Mock external dependencies
vi.mock('../../components/Standings/splineInterpolation', () => ({
  precomputePCHIPTangents: vi.fn(),
}));

describe('ReferenceLapStore', () => {
  const mockBridge = {
    getReferenceLap: vi.fn(),
    saveReferenceLap: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    useReferenceLapStore.getState().completeSession();
    vi.clearAllMocks();
  });

  describe('normalizeKey', () => {
    it('should round to the nearest interval', () => {
      // 0.0025 interval: 0.0026 should become 0.0025
      expect(normalizeKey(0.0026)).toBe(0.0025);
      expect(normalizeKey(0.0049)).toBe(0.0025);
      expect(normalizeKey(0.0051)).toBe(0.005);
    });

    it('should wrap values >= 1 or < 0 to 0', () => {
      expect(normalizeKey(1.001)).toBe(0);
      expect(normalizeKey(-0.001)).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should load persisted laps into the state', async () => {
      const mockLap = { classId: 1, refPoints: new Map() };
      mockBridge.getReferenceLap.mockResolvedValueOnce(mockLap);

      await useReferenceLapStore
        .getState()
        .initialize(mockBridge as ReferenceLapBridge, 100, 200, [1]);

      const state = useReferenceLapStore.getState();
      expect(state.seriesId).toBe(100);
      expect(state.trackId).toBe(200);
      expect(state.persistedLaps.get(1)).toEqual(mockLap);
    });
  });

  describe('collectLapData', () => {
    const carIdx = 5;
    const classId = 1;

    it('should initialize a new active lap on first data point', () => {
      useReferenceLapStore
        .getState()
        .collectLapData(
          mockBridge as ReferenceLapBridge,
          carIdx,
          classId,
          0.1,
          1000,
          TRACK_SURFACES.OnTrack,
          false
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap).toBeDefined();
      expect(activeLap?.startTime).toBe(1000);
      expect(activeLap?.isCleanLap).toBe(true);
    });

    it('should mark lap as dirty if car goes to pit road', () => {
      // 1. Initial clean point
      useReferenceLapStore
        .getState()
        .collectLapData(
          mockBridge as ReferenceLapBridge,
          carIdx,
          classId,
          0.1,
          1000,
          TRACK_SURFACES.OnTrack,
          false
        );

      // 2. Different trackPct so key doesn't collide, but is on Pit Road
      useReferenceLapStore
        .getState()
        .collectLapData(
          mockBridge as ReferenceLapBridge,
          carIdx,
          classId,
          0.31,
          1001,
          TRACK_SURFACES.OnTrack,
          true
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap?.isCleanLap).toBe(false);
    });

    it('should complete a lap and save it if it is the new best clean lap', async () => {
      // Ensure IDs are set so saveReferenceLap is called
      useReferenceLapStore.setState({ seriesId: 1, trackId: 1 });

      const store = useReferenceLapStore.getState();

      // 1. Start a lap near the end
      store.collectLapData(
        mockBridge as ReferenceLapBridge,
        carIdx,
        classId,
        0.96,
        1000,
        TRACK_SURFACES.OnTrack,
        false
      );

      const activeLap = store.activeLaps.get(carIdx);
      // Meet the MIN_POINTS_FOR_VALID_LAP requirement
      for (let i = 0; i < 400; i++) {
        activeLap?.refPoints.set(i, {} as ReferencePoint);
      }

      // 2. Cross the line (0.96 -> 0.01)
      store.collectLapData(
        mockBridge as ReferenceLapBridge,
        carIdx,
        classId,
        0.01,
        1060,
        TRACK_SURFACES.OnTrack,
        false
      );

      expect(precomputePCHIPTangents).toHaveBeenCalled();
      // Check the new state after completion
      expect(
        useReferenceLapStore.getState().bestLaps.get(carIdx)
      ).toBeDefined();
      expect(mockBridge.saveReferenceLap).toHaveBeenCalled();
    });

    it('should not save lap if it is not clean', () => {
      const store = useReferenceLapStore.getState();

      // Start dirty
      store.collectLapData(
        mockBridge as ReferenceLapBridge,
        carIdx,
        classId,
        0.96,
        1000,
        TRACK_SURFACES.OnTrack,
        true
      );
      const activeLap = store.activeLaps.get(carIdx);
      for (let i = 0; i < 400; i++) {
        if (activeLap) activeLap.refPoints.set(i, {} as ReferencePoint);
      }

      // Complete lap
      store.collectLapData(
        mockBridge as ReferenceLapBridge,
        carIdx,
        classId,
        0.01,
        1060,
        TRACK_SURFACES.OnTrack,
        false
      );

      expect(store.bestLaps.has(carIdx)).toBe(false);
      expect(mockBridge.saveReferenceLap).not.toHaveBeenCalled();
    });
  });

  describe('completeSession', () => {
    it('should reset all maps and IDs', () => {
      // Manually populate old state
      useReferenceLapStore.getState().activeLaps.set(1, {} as ReferenceLap);
      useReferenceLapStore.setState({ seriesId: 50 });

      useReferenceLapStore.getState().completeSession();

      // IMPORTANT: Always fetch state AFTER the action to get the new object
      const state = useReferenceLapStore.getState();
      expect(state.activeLaps.size).toBe(0);
      expect(state.seriesId).toBeNull();
      expect(state.bestLaps.size).toBe(0);
    });
  });
});
