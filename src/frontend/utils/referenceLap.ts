export const getBucketIndex = (trackPct: number, pointsCount: number): number =>
  Math.min(Math.max(Math.floor(trackPct * pointsCount), 0), pointsCount - 1);
