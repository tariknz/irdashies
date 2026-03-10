import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useReferenceLapStore,
  normalizeKey,
  REFERENCE_INTERVAL,
} from './ReferenceLapStore';
import { ReferenceLap, ReferencePoint, TrackLocation } from '@irdashies/types';
import { precomputePCHIPTangents } from './pchipTangents';
import { ReferenceLapBridge } from '@irdashies/types';

// Mock external dependencies
vi.mock('./pchipTangents', () => ({
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
          0.04,
          1000,
          TrackLocation.OnTrack,
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
          TrackLocation.OnTrack,
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
          TrackLocation.OnTrack,
          true
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap?.isCleanLap).toBe(false);
    });

    it('should complete a lap and save it if it is the new best clean lap', async () => {
      // 1. Setup Initial State
      useReferenceLapStore.setState({
        seriesId: 1,
        trackId: 1,
        activeLaps: new Map(),
        bestLaps: new Map(),
        persistedLaps: new Map(),
      });

      const carIdx = 1;
      const classId = 10;

      // 2. Start a lap (Initial point)
      useReferenceLapStore
        .getState()
        .collectLapData(
          mockBridge as ReferenceLapBridge,
          carIdx,
          classId,
          0.01,
          1000,
          TrackLocation.OnTrack,
          false
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);

      // 3. Meet the validation requirements:
      // - MIN_POINTS_FOR_VALID_LAP (>= 300 based on your constants)
      // - lastTrackedPct must be > 0.95 to trigger completion logic
      if (activeLap) {
        for (let i = 0; i < 400; i++) {
          activeLap.refPoints.set(
            normalizeKey(i * REFERENCE_INTERVAL + 0.0001),
            {
              trackPct: i * REFERENCE_INTERVAL,
              timeElapsedSinceStart: i,
              tangent: undefined,
            }
          );
        }
        activeLap.lastTrackedPct = 0.96; // CRITICAL: Required for isLapComplete
        activeLap.isCleanLap = true;
      }

      // 4. Cross the line (Trigger completion)
      // Current trackPct (0.01) < 0.05 and lastTrackedPct (0.96) > 0.95
      useReferenceLapStore
        .getState()
        .collectLapData(
          mockBridge as ReferenceLapBridge,
          carIdx,
          classId,
          0.01,
          1060,
          TrackLocation.OnTrack,
          false
        );

      // 5. Assertions
      expect(precomputePCHIPTangents).toHaveBeenCalled();

      const finalState = useReferenceLapStore.getState();
      expect(finalState.bestLaps.get(carIdx)).toBeDefined();
      expect(finalState.persistedLaps.get(classId)).toBeDefined();

      // Ensure bridge was called
      expect(mockBridge.saveReferenceLap).toHaveBeenCalledWith(
        1,
        1,
        classId,
        expect.any(Object)
      );
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
        TrackLocation.OnTrack,
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
        TrackLocation.OnTrack,
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
