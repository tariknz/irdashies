import { describe, it } from 'vitest';
import { useReferenceLapStore } from './ReferenceLapStore';
import { ReferenceLapBridge, Driver } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

describe('ReferenceLapStore Benchmark', () => {
  it('measures performance of collectBulkData with 64 drivers (1 minute simulation)', () => {
    const bridge = {
      saveReferenceLap: () => Promise.resolve(),
      getReferenceLap: () => Promise.resolve(null),
    } as unknown as ReferenceLapBridge;

    const pointsCount = 2000; // Nordschleife scale (approx 10m buckets)
    const interval = 1 / pointsCount;

    // Reset and setup store state
    useReferenceLapStore.getState().completeSession();
    useReferenceLapStore.setState({
      pointsCount,
      interval,
      seriesId: 1,
      trackId: 1,
    });

    // Create a full 64-car grid
    const drivers = Array.from({ length: 64 }, (_, i) => ({
      CarIdx: i,
      CarClassID: Math.floor(i / 10), // Simulate a few different classes
    })) as Driver[];

    // 1 minute at 25Hz = 1500 frames
    const iterations = 1500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const sessionTime = i * 0.04; // 25Hz (40ms steps)

      const carIdxLapDistPct = drivers.map(
        (d) => (i * 0.0005 + d.CarIdx * 0.01) % 1
      );
      const carIdxOnPitRoad = drivers.map(() => false);

      useReferenceLapStore
        .getState()
        .collectBulkData(
          bridge,
          drivers,
          carIdxLapDistPct,
          carIdxOnPitRoad,
          sessionTime
        );
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTimePerFrame = totalTime / iterations;

    logger.info('--------------------------------------------------');
    logger.info(`[Benchmark] Optimized Implementation (collectBulkData)`);
    logger.info(`[Benchmark] Simulated Time: 60 seconds (1500 frames @ 25Hz)`);
    logger.info(`[Benchmark] Drivers: 64`);
    logger.info(`[Benchmark] Total CPU Time: ${totalTime.toFixed(2)}ms`);
    logger.info(
      `[Benchmark] Avg Time Per Frame: ${avgTimePerFrame.toFixed(4)}ms`
    );
    logger.info('--------------------------------------------------');
  });
});
