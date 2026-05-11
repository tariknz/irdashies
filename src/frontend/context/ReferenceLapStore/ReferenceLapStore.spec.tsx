import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReferenceLapStore, getBucketIndex } from './ReferenceLapStore';
import { ReferenceLap } from '@irdashies/types';
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

  describe('getBucketIndex', () => {
    it('should return index 1 with track % 0.01 and point count 100', () => {
      expect(getBucketIndex(0.01, 100)).toBe(1);
    });

    it('should return index 0 with track % 0.005 and point count 100', () => {
      expect(getBucketIndex(0.005, 100)).toBe(0);
    });

    it('should return index 99 with track % 1 and point count 100', () => {
      expect(getBucketIndex(1, 100)).toBe(99);
    });

    it('should return 0 for trackPct 0', () => {
      expect(getBucketIndex(0, 100)).toBe(0);
    });

    it('should clamp to 0 for negative trackPct', () => {
      expect(getBucketIndex(-0.1, 100)).toBe(0);
    });

    it('should clamp to pointsCount - 1 for trackPct > 1', () => {
      expect(getBucketIndex(1.1, 100)).toBe(99);
    });
  });

  describe('initialize', () => {
    it('should load persisted laps into the state', async () => {
      const mockLap = {
        startTime: 100,
        finishTime: 160,
        times: new Float32Array([0, 10, 20]),
        pointPos: new Float32Array([0, 0.3, 0.6]),
        tangents: new Float32Array([0, 0, 0]),
        pointsCount: 3,
        interval: 0.33,
      };
      mockBridge.getReferenceLap.mockResolvedValueOnce(mockLap);

      await useReferenceLapStore
        .getState()
        .initialize(mockBridge as ReferenceLapBridge, 100, 200, 1000, [1]);

      const state = useReferenceLapStore.getState();
      expect(state.seriesId).toBe(100);
      expect(state.trackId).toBe(200);
      expect(state.persistedLaps.get(1)).toEqual(mockLap);
    });
  });

  describe('collectBulkData', () => {
    const carIdx = 5;
    const classId = 1;
    const drivers = [{ CarIdx: carIdx, CarClassID: classId }];

    beforeEach(() => {
      // Initialize store with some dimensions
      useReferenceLapStore.setState({
        pointsCount: 100,
        interval: 0.01,
      });
    });

    it('should initialize a new active lap on first data point', () => {
      const store = useReferenceLapStore.getState();
      const trackPct = 0.005;
      const dists = [];
      dists[carIdx] = trackPct;
      const pits = [];
      pits[carIdx] = false;

      // 1. First call initializes
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists,
        pits,
        1000
      );

      // 2. Second call (same bucket) should store if clean
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists,
        pits,
        1001
      );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap).toBeDefined();
      expect(activeLap?.times.length).toBe(100);
      expect(activeLap?.pointPos[getBucketIndex(trackPct, 100)]).toBeCloseTo(
        trackPct
      );
      expect(activeLap?.isCleanLap).toBe(true);
    });

    it('should initialize a clean active lap if started near start line', () => {
      const dists = [];
      dists[carIdx] = 0.005;
      const pits = [];
      pits[carIdx] = false;

      useReferenceLapStore
        .getState()
        .collectBulkData(
          mockBridge as ReferenceLapBridge,
          drivers,
          dists,
          pits,
          1000
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap?.isCleanLap).toBe(true);
    });

    it('should mark lap as dirty if car goes to pit road', () => {
      const dists1 = [];
      dists1[carIdx] = 0.005;
      const dists2 = [];
      dists2[carIdx] = 0.31;
      const pits1 = [];
      pits1[carIdx] = false;
      const pits2 = [];
      pits2[carIdx] = true;

      // 1. Initial clean point
      useReferenceLapStore
        .getState()
        .collectBulkData(
          mockBridge as ReferenceLapBridge,
          drivers,
          dists1,
          pits1,
          1000
        );

      // 2. Go to Pit Road
      useReferenceLapStore
        .getState()
        .collectBulkData(
          mockBridge as ReferenceLapBridge,
          drivers,
          dists2,
          pits2,
          1001
        );

      const activeLap = useReferenceLapStore.getState().activeLaps.get(carIdx);
      expect(activeLap?.isCleanLap).toBe(false);
    });

    it('should complete a lap and save it if it is the new best clean lap', async () => {
      useReferenceLapStore.setState({ seriesId: 1, trackId: 1 });
      const store = useReferenceLapStore.getState();

      const dists1 = [];
      dists1[carIdx] = 0.005;
      const dists2 = [];
      dists2[carIdx] = 0.96;
      const dists3 = [];
      dists3[carIdx] = 0.01;
      const pits = [];
      pits[carIdx] = false;

      // 1. Start a lap near the start
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists1,
        pits,
        1000
      );

      // 2. Get near the end
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists2,
        pits,
        1050
      );

      // 3. Cross the line (0.96 -> 0.01)
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists3,
        pits,
        1060
      );

      expect(precomputePCHIPTangents).toHaveBeenCalled();
      expect(
        useReferenceLapStore.getState().bestLaps.get(carIdx)
      ).toBeDefined();
      expect(mockBridge.saveReferenceLap).toHaveBeenCalled();
    });

    it('should not save lap if it is not clean', () => {
      const store = useReferenceLapStore.getState();

      const dists1 = [];
      dists1[carIdx] = 0.5;
      const dists2 = [];
      dists2[carIdx] = 0.96;
      const dists3 = [];
      dists3[carIdx] = 0.01;
      const pits = [];
      pits[carIdx] = false;

      // Start dirty (far from start line)
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists1,
        pits,
        1000
      );

      // Get near the end
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists2,
        pits,
        1050
      );

      // Complete lap
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists3,
        pits,
        1060
      );

      expect(store.bestLaps.has(carIdx)).toBe(false);
      expect(mockBridge.saveReferenceLap).not.toHaveBeenCalled();
    });
  });

  describe('completeSession', () => {
    it('should reset all maps and IDs', () => {
      useReferenceLapStore.getState().activeLaps.set(1, {} as ReferenceLap);
      useReferenceLapStore.setState({ seriesId: 50 });

      useReferenceLapStore.getState().completeSession();

      const state = useReferenceLapStore.getState();
      expect(state.activeLaps.size).toBe(0);
      expect(state.seriesId).toBeNull();
      expect(state.bestLaps.size).toBe(0);
    });
  });
});
