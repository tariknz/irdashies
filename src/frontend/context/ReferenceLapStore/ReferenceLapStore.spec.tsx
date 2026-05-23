import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReferenceLapStore, getBucketIndex } from './ReferenceLapStore';
import { Driver, ReferenceLap } from '@irdashies/types';
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

    it('should populate pointPos for the initial bucket when a new lap is created', () => {
      const store = useReferenceLapStore.getState();
      const trackPct = 0.005; // bucket 0
      const dists = [];
      dists[carIdx] = trackPct;
      const pits = [];
      pits[carIdx] = false;

      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists,
        pits,
        1000
      );

      const activeLap = store.activeLaps.get(carIdx);
      expect(activeLap).toBeDefined();
      const bucketIdx = getBucketIndex(trackPct, 100);
      expect(activeLap?.pointPos[bucketIdx]).toBeCloseTo(-1);
      expect(activeLap?.times[bucketIdx]).toBe(0);
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

    it('should populate pointPos for the initial bucket when a lap is completed and a new one starts', () => {
      useReferenceLapStore.setState({ seriesId: 1, trackId: 1 });
      const store = useReferenceLapStore.getState();

      const dists1 = [];
      dists1[carIdx] = 0.005;
      const dists2 = [];
      dists2[carIdx] = 0.96;
      const dists3 = [];
      dists3[carIdx] = 0.01; // Crossing the line
      const pits = [];
      pits[carIdx] = false;

      // 1. Start a lap
      store.collectBulkData(
        mockBridge as unknown as ReferenceLapBridge,
        drivers,
        dists1,
        pits,
        1000
      );

      // Fill continuity gaps to allow promotion (not strictly needed for this test but good practice)
      const lap1 = store.activeLaps.get(carIdx) ?? ({} as ReferenceLap);
      for (let i = 1; i < 96; i++) {
        lap1.pointPos[i] = i / 100;
        lap1.times[i] = i * 10;
      }
      lap1.lastTrackedPct = 0.95;

      // 2. Cross the line
      store.collectBulkData(
        mockBridge as unknown as ReferenceLapBridge,
        drivers,
        dists2,
        pits,
        1050
      );
      store.collectBulkData(
        mockBridge as unknown as ReferenceLapBridge,
        drivers,
        dists3,
        pits,
        1060
      );

      // Check the NEW active lap
      const newActiveLap = store.activeLaps.get(carIdx);
      expect(newActiveLap).toBeDefined();
      expect(newActiveLap).not.toBe(lap1);
      const bucketIdx = getBucketIndex(0.01, 100);
      expect(newActiveLap?.pointPos[bucketIdx]).toBeCloseTo(-1);
      expect(newActiveLap?.times[bucketIdx]).toBe(0);
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

    it('should handle sparse drivers arrays with undefined holes without crashing', () => {
      const store = useReferenceLapStore.getState();
      const trackPct = 0.005;

      // Create a sparse array with a hole at index 0 and a driver at index 1
      const sparseDrivers = [] as Driver[];
      sparseDrivers[1] = { CarIdx: 1, CarClassID: 10 } as Driver;

      const dists = [] as number[];
      dists[1] = trackPct;
      const pits = [] as boolean[];
      pits[1] = false;

      // This should not throw TypeError
      expect(() => {
        store.collectBulkData(
          mockBridge as ReferenceLapBridge,
          sparseDrivers as { CarIdx: number; CarClassID: number }[],
          dists,
          pits,
          1000
        );
      }).not.toThrow();

      const activeLap = store.activeLaps.get(1);
      expect(activeLap).toBeDefined();
    });

    it('should mark lap as dirty if a gap in buckets is detected', () => {
      const store = useReferenceLapStore.getState();
      const dists1 = [];
      dists1[carIdx] = 0.005; // bucket 0
      const dists2 = [];
      dists2[carIdx] = 0.025; // bucket 2 (skips bucket 1)
      const pits = [];
      pits[carIdx] = false;

      // 1. Initial point
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists1,
        pits,
        1000
      );

      // 2. Point with a gap
      store.collectBulkData(
        mockBridge as ReferenceLapBridge,
        drivers,
        dists2,
        pits,
        1001
      );

      const activeLap = store.activeLaps.get(carIdx);
      expect(activeLap?.isCleanLap).toBe(false);
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

      // Manually fill buckets to satisfy the continuity check
      const activeLap = store.activeLaps.get(carIdx);
      if (activeLap) {
        for (let i = 1; i < 96; i++) {
          activeLap.pointPos[i] = i / 100;
          activeLap.times[i] = i * 10;
        }
        activeLap.lastTrackedPct = 0.95;
      }

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
