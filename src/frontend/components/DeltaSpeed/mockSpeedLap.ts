import type { ReferenceLap } from '@irdashies/types';

/**
 * Builds a synthetic reference lap from an explicit speed profile, for stories
 * and tests. Not imported by the app.
 *
 * Because the speed at every bucket is generated from a known function, the
 * profile doubles as exact ground truth: interpolateSpeedAtPoint() evaluated at
 * a bucket position must return that bucket's speed back.
 */

/** Corner: centre position around the lap, apex speed drop, and width. */
interface Corner {
  pct: number;
  depthKph: number;
  width: number;
}

const DEFAULT_TOP_KPH = 258;

/** Roughly a 6.4km circuit: five braking zones of varying severity. */
const DEFAULT_CORNERS: Corner[] = [
  { pct: 0.11, depthKph: 130, width: 0.035 },
  { pct: 0.22, depthKph: 95, width: 0.028 },
  { pct: 0.38, depthKph: 150, width: 0.04 },
  { pct: 0.57, depthKph: 80, width: 0.025 },
  { pct: 0.79, depthKph: 140, width: 0.045 },
];

/** Speed in km/h at a point on the lap, as a smooth function of position. */
export function mockSpeedAt(
  pct: number,
  topKph = DEFAULT_TOP_KPH,
  corners = DEFAULT_CORNERS
): number {
  let speed = topKph;
  for (const corner of corners) {
    // Shortest distance around the lap, so corners near the line wrap properly.
    let d = Math.abs(pct - corner.pct);
    if (d > 0.5) d = 1 - d;
    speed -= corner.depthKph * Math.exp(-((d / corner.width) ** 2));
  }
  return Math.max(speed, 40);
}

export interface MockSpeedLapOptions {
  trackLength?: number;
  topKph?: number;
  corners?: Corner[];
  /** Omit the speed trace entirely, as an opponent-sourced or legacy lap. */
  withoutSpeeds?: boolean;
}

export function buildMockSpeedLap({
  trackLength = 6413.5,
  topKph = DEFAULT_TOP_KPH,
  corners = DEFAULT_CORNERS,
  withoutSpeeds = false,
}: MockSpeedLapOptions = {}): ReferenceLap {
  // 10m buckets, matching ReferenceLapStore.initialize()
  const pointsCount = Math.ceil(trackLength / 10);
  const interval = 1 / pointsCount;
  const segmentMeters = trackLength * interval;

  const pointPos = new Float32Array(pointsCount);
  const times = new Float32Array(pointsCount);
  const tangents = new Float32Array(pointsCount);
  const speedsKph = new Float32Array(pointsCount);

  let elapsed = 0;
  for (let i = 0; i < pointsCount; i++) {
    const pct = i * interval;
    const kph = mockSpeedAt(pct, topKph, corners);
    const ms = kph / 3.6;

    pointPos[i] = pct;
    times[i] = elapsed;
    speedsKph[i] = kph;
    // d(time)/d(trackPct) — the same quantity ReferenceLapStore precomputes.
    tangents[i] = trackLength / ms;

    elapsed += segmentMeters / ms;
  }

  return {
    startTime: 0,
    finishTime: elapsed,
    times,
    pointPos,
    tangents,
    interval,
    pointsCount,
    lastTrackedPct: (pointsCount - 1) * interval,
    isCleanLap: true,
    ...(withoutSpeeds ? {} : { speedsKph }),
  };
}
