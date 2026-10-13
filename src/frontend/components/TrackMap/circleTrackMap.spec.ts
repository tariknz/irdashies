import { describe, expect, it } from 'vitest';
import { CIRCLE_TRACK_MAP } from './circleTrackMap';

describe('CIRCLE_TRACK_MAP', () => {
  it('starts on the left and climbs in the first quarter, matching TinyPedal', () => {
    const points = CIRCLE_TRACK_MAP.active.trackPathPoints ?? [];
    const start = points[0];
    const quarter = points[Math.round((points.length - 1) / 4)];

    expect(start.x).toBe(Math.min(...points.map((point) => point.x)));
    expect(quarter.y).toBeLessThan(start.y);
    expect(quarter.x).toBeGreaterThan(start.x);
  });
});
