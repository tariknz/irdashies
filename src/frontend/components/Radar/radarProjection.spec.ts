import { describe, expect, it } from 'vitest';
import { buildTrackGeometry } from '@irdashies/domain/track';
import { RadarProjector, type ScreenPose } from './radarProjection';

const circle = (radius: number, steps = 720) => {
  const trackPathPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * 2 * Math.PI;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
  return {
    trackPathPoints,
    totalLength: 2 * Math.PI * radius,
    startFinishLength: 0,
    direction: 'anticlockwise' as const,
  };
};

describe('RadarProjector.project', () => {
  const pose: ScreenPose = { x: 0, y: 0, angle: 0 };

  it('places local offsets in the focus frame even on a curved track', () => {
    const trackLength = 600;
    const geometry = buildTrackGeometry(circle(100), trackLength);
    const projector = new RadarProjector();
    projector.setup(geometry, trackLength, 0.2, 200, 200, 2);

    projector.project(30, 4, pose, true);

    expect(pose.x).toBeCloseTo(200 - 4 * 2);
    expect(pose.y).toBeCloseTo(200 - 30 * 2);
  });

  it('bends track-relative offsets along the drawn centreline', () => {
    const trackLength = 600;
    const geometry = buildTrackGeometry(circle(100), trackLength);
    const projector = new RadarProjector();
    projector.setup(geometry, trackLength, 0.2, 200, 200, 2);

    projector.project(30, 0, pose);

    expect(Math.abs(pose.x - 200)).toBeGreaterThan(1);
  });
});
