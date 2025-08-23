import { TimingDataPoint, CarClassTimingData } from './types';

/**
 * Binary search + linear interpolation to get time at specific distance
 * Based on the Kapps implementation
 */
export const getTimeByDistance = (
  record: CarClassTimingData,
  dist: number
): number | null => {
  if (!record || !record.items || record.items.length < 3) {
    return null;
  }

  const items = record.items;
  const len = items.length;
  let imin = 0;
  let imax = len - 1;

  // Handle edge cases - extrapolate beyond recorded range
  if (dist < items[imin].dist) {
    if (len > 5) {
      const i0 = items[imin];
      const i1 = items[imin + 1];
      return i0.time - ((i1.time - i0.time) / (i1.dist - i0.dist)) * (i0.dist - dist);
    }
    return null;
  }

  if (dist > items[imax].dist) {
    if (len > 5) {
      const im = items[imax];
      const im1 = items[imax - 1];
      return im.time + ((im.time - im1.time) / (im.dist - im1.dist)) * (dist - im.dist);
    }
    return null;
  }

  // Binary search to find the right interval
  while (imax - imin > 1) {
    const imid = (imin + imax) >> 1; // Fast integer division by 2
    if (dist > items[imid].dist) {
      imin = imid;
    } else {
      imax = imid;
    }
  }

  // Ensure we have the correct bounds
  while (imin > 0 && items[imin].dist > dist) imin--;
  while (imax < len - 1 && items[imax].dist < dist) imax++;

  // Linear interpolation between the two closest points
  const min = items[imin];
  const max = items[imax];

  if (min.dist <= dist && dist <= max.dist) {
    const diffDist = max.dist - min.dist;
    const timeDist = max.time - min.time;
    return min.time + ((dist - min.dist) / diffDist) * timeDist;
  }

  return null;
};

/**
 * Calculate time delta between two cars using interpolation
 * Falls back to estimation if no timing data available
 */
export const calculateTimeDelta = (
  bestLapByCarClass: Map<number, CarClassTimingData>,
  playerCarIdx: number,
  otherCarIdx: number,
  playerDist: number,
  otherDist: number,
  drivers: { carIdx: number; carClass?: { id?: number; estLapTime?: number } }[]
): number | null => {
  const player = drivers.find((driver) => driver.carIdx === playerCarIdx);
  const other = drivers.find((driver) => driver.carIdx === otherCarIdx);

  if (!player || !other) {
    return null;
  }

  // Try to use the same car class for both, prefer the player's class
  const carClassId = player.carClass?.id || other.carClass?.id;
  if (!carClassId) {
    return null;
  }

  const timingRecord = bestLapByCarClass.get(carClassId);

  if (timingRecord) {
    const playerTime = getTimeByDistance(timingRecord, playerDist);
    const otherTime = getTimeByDistance(timingRecord, otherDist);

    if (playerTime !== null && otherTime !== null) {
      let timeDelta = otherTime - playerTime;

      // Handle lap crossing - if cars are on different sides of start/finish
      if (otherDist < playerDist && (playerDist - otherDist) > 0.5) {
        // Other car is ahead but crossed start/finish line
        timeDelta += timingRecord.lapTime;
      } else if (playerDist < otherDist && (otherDist - playerDist) > 0.5) {
        // Player is ahead but other car crossed start/finish line
        timeDelta -= timingRecord.lapTime;
      }

      return timeDelta;
    }
  }

  // Fallback to estimation method (original implementation)
  const playerEstLapTime = player?.carClass?.estLapTime ?? 0;
  const otherEstLapTime = other?.carClass?.estLapTime ?? 0;
  const baseLapTime = Math.max(playerEstLapTime, otherEstLapTime);

  if (baseLapTime === 0) {
    return null;
  }

  let distPctDifference = otherDist - playerDist;

  if (distPctDifference > 0.5) {
    distPctDifference -= 1.0;
  } else if (distPctDifference < -0.5) {
    distPctDifference += 1.0;
  }

  return distPctDifference * baseLapTime;
};

/**
 * Process completed lap and determine if it's the best for this car class
 */
export const processCompletedLap = (
  timingPoints: TimingDataPoint[],
  carClassId: number,
  sessionNum: number,
  trackId: number,
  bestLapByCarClass: Map<number, CarClassTimingData>
): boolean => {
  if (timingPoints.length < 10) {
    return false; // Not enough data points for quality interpolation
  }

  // Sort by distance to ensure proper order
  const sortedPoints = [...timingPoints].sort((a, b) => a.dist - b.dist);

  // Check data quality - reject if there are large gaps
  const maxDistanceGap = 0.15; // 15% of track
  for (let i = 1; i < sortedPoints.length; i++) {
    const gap = sortedPoints[i].dist - sortedPoints[i - 1].dist;
    if (gap > maxDistanceGap) {
      return false; // Gap too large, reject this lap
    }
  }

  // Calculate full lap time using extrapolation (Kapps method)
  const lapTime = calculateFullLapTime(sortedPoints);
  if (!lapTime || lapTime <= 0 || lapTime > 600) {
    return false; // Invalid lap time
  }

  // Check if this is better than existing best lap
  const existing = bestLapByCarClass.get(carClassId);
  if (existing && lapTime >= existing.lapTime) {
    return false; // Not better than existing
  }

  // Normalize data points to cover full 0-1 range
  const normalizedPoints = normalizeTimingPoints(sortedPoints);

  bestLapByCarClass.set(carClassId, {
    carClassId,
    lapTime,
    items: normalizedPoints,
    sessionNum,
    trackId,
  });

  return true;
};

/**
 * Calculate full lap time using extrapolation (based on Kapps method)
 */
const calculateFullLapTime = (points: TimingDataPoint[]): number | null => {
  if (points.length < 3) return null;

  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  const first = points[0];

  const timeDist = last.time - secondLast.time;
  const diffDist = last.dist - secondLast.dist;

  if (diffDist === 0) return null;

  return (
    secondLast.time -
    ((secondLast.dist - first.dist) * timeDist) / diffDist -
    first.time
  );
};

/**
 * Normalize timing points to ensure full track coverage
 */
const normalizeTimingPoints = (
  points: TimingDataPoint[]
): TimingDataPoint[] => {
  const normalized = [...points];

  // Add extrapolated start point (dist = 0) if needed
  if (normalized[0].dist > 0.05) {
    const first = normalized[0];
    const second = normalized[1];
    const slope = (second.time - first.time) / (second.dist - first.dist);
    normalized.unshift({
      dist: 0,
      time: first.time - first.dist * slope,
    });
  }

  // Add extrapolated end point (dist = 1) if needed
  const lastPoint = normalized[normalized.length - 1];
  if (lastPoint.dist < 0.95) {
    const secondLast = normalized[normalized.length - 2];
    const slope = (lastPoint.time - secondLast.time) / (lastPoint.dist - secondLast.dist);
    normalized.push({
      dist: 1,
      time: lastPoint.time + (1 - lastPoint.dist) * slope,
    });
  }

  return normalized;
};
