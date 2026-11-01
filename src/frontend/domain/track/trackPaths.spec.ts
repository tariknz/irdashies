import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTrackPathData } from './trackPaths';
import type { TrackDrawing } from './trackDrawing';

const drawing: TrackDrawing = {
  active: {
    inside: 'M0 0',
    outside: '',
    trackPathPoints: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    totalLength: 10,
  },
  startFinish: { point: { length: 0 }, direction: 'clockwise' },
};

describe('getTrackPathData', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('extracts geometry from an already loaded drawing without copying points', () => {
    const path = getTrackPathData(1, drawing);
    expect(path).toEqual({
      trackPathPoints: drawing.active.trackPathPoints,
      totalLength: 10,
      startFinishLength: 0,
      direction: 'clockwise',
    });
    expect(path?.trackPathPoints).toBe(drawing.active.trackPathPoints);
  });

  it('returns no geometry while loading or when path metadata is absent', () => {
    expect(getTrackPathData(1, null)).toBeNull();
    expect(getTrackPathData(undefined, drawing)).toBeNull();
    expect(getTrackPathData(1, { ...drawing, startFinish: {} })).toBeNull();
  });

  it('preserves broken-track filtering in production', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');
    expect(getTrackPathData(175, drawing)).toBeNull();
    expect(getTrackPathData(1, drawing)).not.toBeNull();
  });
});
