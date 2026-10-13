import type { TrackDrawing } from './TrackCanvas';

const WIDTH = 1920;
const HEIGHT = 1080;
const POINTS = 128;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 420;

// Same placement as TinyPedal's temporary circle: lap start on the left,
// progress runs toward the top of the screen.
const trackPathPoints = Array.from({ length: POINTS }, (_, index) => {
  const theta = (2 * Math.PI * index) / (POINTS - 1);
  return {
    x: Number((CENTER_X - RADIUS * Math.cos(theta)).toFixed(2)),
    y: Number((CENTER_Y - RADIUS * Math.sin(theta)).toFixed(2)),
  };
});

const path = `${trackPathPoints
  .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
  .join(' ')} Z`;
const start = trackPathPoints[0];

export const CIRCLE_TRACK_MAP: TrackDrawing = {
  active: {
    inside: path,
    outside: path,
    trackPathPoints,
    totalLength: trackPathPoints.length - 1,
  },
  startFinish: {
    line: `M${start.x - 40},${start.y} L${start.x + 40},${start.y}`,
    point: { ...start, length: 0 },
    direction: 'anticlockwise',
  },
};
