import type { RadarDrawFollow } from './radarDrawTypes';
import { MIN_TEXT_PX, pose } from './radarDrawShared';
import { formatDistance } from './radarStyle';

export const FOLLOW_COLOR = '#22c55e';
export const PACE_CAR_FILL = '#e2e8f0';

export const FOLLOW_DASH = [6, 5];

/**
 * Ends of the line from our car to the one we follow, each pulled in by half
 * a car so it runs nose to tail, or null when the cars nearly touch.
 */
export const followLineEnds = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromHalfLength: number,
  toHalfLength: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= fromHalfLength + toHalfLength + 2) return null;
  const ux = dx / distance;
  const uy = dy / distance;
  return {
    x1: from.x + ux * fromHalfLength,
    y1: from.y + uy * fromHalfLength,
    x2: to.x - ux * toHalfLength,
    y2: to.y - uy * toHalfLength,
  };
};

/** Dashed line tying our car to the one we have to hold station behind. */
export const drawFollowLine = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  target: { x: number; y: number },
  playerLength: number,
  targetLength: number
) => {
  const ends = followLineEnds(
    { x: centre, y: centre },
    target,
    playerLength / 2,
    targetLength / 2
  );
  if (!ends) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ends.x1, ends.y1);
  ctx.lineTo(ends.x2, ends.y2);
  ctx.setLineDash(FOLLOW_DASH);
  ctx.lineWidth = 2;
  ctx.strokeStyle = FOLLOW_COLOR;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();
};

export const drawFollowOutline = (
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number
) => {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const pad = Math.max(2, width * 0.25);
  ctx.beginPath();
  ctx.roundRect(
    -length / 2 - pad,
    -width / 2 - pad,
    length + pad * 2,
    width + pad * 2,
    pad * 2
  );
  ctx.lineWidth = 2;
  ctx.strokeStyle = FOLLOW_COLOR;
  ctx.stroke();
  ctx.restore();
};

/** Chevron on the rim pointing at a follow target beyond the range. */
export const drawFollowPointer = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  follow: RadarDrawFollow,
  metric: boolean
) => {
  const bearing = Math.atan2(pose.y - centre, pose.x - centre);
  const tipX = centre + Math.cos(bearing) * (radius - 3);
  const tipY = centre + Math.sin(bearing) * (radius - 3);
  const size = Math.max(7, radius / 12);
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(bearing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.7);
  ctx.lineTo(-size, size * 0.7);
  ctx.closePath();
  ctx.fillStyle = FOLLOW_COLOR;
  ctx.fill();
  ctx.restore();

  const fontSize = Math.max(MIN_TEXT_PX, Math.round(radius / 11));
  ctx.font = `bold ${fontSize}px Lato, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelDistance = radius - size - fontSize * 1.2;
  const text =
    `${follow.label} ${formatDistance(Math.abs(follow.dist), metric)}`.trim();
  ctx.fillStyle = FOLLOW_COLOR;
  ctx.fillText(
    text,
    centre + Math.cos(bearing) * labelDistance,
    centre + Math.sin(bearing) * labelDistance
  );
};
