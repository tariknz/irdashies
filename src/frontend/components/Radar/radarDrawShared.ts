import { RadarProjector, type ScreenPose } from './radarProjection';

/** Smallest ring label and pointer text, whatever the label setting. */
export const MIN_TEXT_PX = 8;

export const projector = new RadarProjector();
export const pose: ScreenPose = { x: 0, y: 0, angle: 0 };

export const drawCarBody = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  fill: string
) => {
  ctx.save();
  ctx.translate(x, y);
  // Body length runs along the direction of travel.
  ctx.rotate(angle);
  const radius = Math.min(width, length) * 0.25;
  ctx.beginPath();
  ctx.roundRect(-length / 2, -width / 2, length, width, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.stroke();
  ctx.restore();
};
