import type { ScreenPose } from './radarProjection';
import type { RadarArcStyle } from '@irdashies/types';
import { arcThicknessPx, paintRimArc } from './radarArcs';
import type { RadarStyle } from './radarDrawTypes';
import { pose } from './radarDrawShared';

export const drawWarningOutline = (
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  color: string
) => {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const pad = Math.max(1.5, width * 0.12);
  ctx.beginPath();
  ctx.roundRect(
    -length / 2 - pad,
    -width / 2 - pad,
    length + pad * 2,
    width + pad * 2,
    pad * 2
  );
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
};

export interface RimWarning {
  x: number;
  y: number;
  carLengthPx: number;
  color: string;
  alpha: number;
  arcStyle: RadarArcStyle;
  minDeg: number;
  maxDeg: number;
  /** 0-1, for how many segments light. */
  urgency: number;
}

/**
 * A strip along one side of a car (side -1 its left, +1 its right) filled
 * from the rear to `share` of its length, with a notch at `threshold`.
 */
export const drawOverlapStrip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  side: number,
  share: number,
  threshold: number,
  color: string
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const thickness = Math.max(2, width * 0.3);
  const across = side * (width / 2 - thickness / 2);
  const rear = -length / 2;
  ctx.lineCap = 'butt';
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(rear, across);
  ctx.lineTo(-rear, across);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rear, across);
  ctx.lineTo(rear + length * share, across);
  ctx.strokeStyle = color;
  ctx.stroke();
  const notch = rear + length * threshold;
  ctx.beginPath();
  ctx.moveTo(notch, across - thickness / 2 - 1);
  ctx.lineTo(notch, across + thickness / 2 + 1);
  ctx.lineWidth = Math.max(1, thickness * 0.4);
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();
  ctx.restore();
};

/** Text with a dark rim so it reads over cars and the road. */
export const drawHintText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  align: CanvasTextAlign
) => {
  // Saved, so the car-number font set up for the loop survives.
  ctx.save();
  ctx.font = `bold ${fontSize}px Lato, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
};

/** The overlap in per cent, behind the car on the strip's side. */
export const drawOverlapPercent = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  side: number,
  share: number,
  color: string,
  fontSize: number
) => {
  // Beside the car is where the rival is, so the space behind is clearer.
  const along = -length / 2 - fontSize * 0.9;
  // Cars near ours point up too, so their local left is the screen's left.
  const across = side * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  drawHintText(
    ctx,
    `${Math.round(share * 100)}%`,
    x + cos * along - sin * across,
    y + sin * along + cos * across,
    color,
    fontSize,
    side < 0 ? 'right' : 'left'
  );
};

export const ghostPose: ScreenPose = { x: 0, y: 0, angle: 0 };

/** Dashed outline where a diving car is headed, and an arrow to it. */
export const drawDiveGhost = (
  ctx: CanvasRenderingContext2D,
  from: ScreenPose,
  to: ScreenPose,
  length: number,
  width: number,
  color: string
) => {
  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(to.angle);
  ctx.beginPath();
  ctx.roundRect(
    -length / 2,
    -width / 2,
    length,
    width,
    Math.min(width, length) * 0.25
  );
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.15;
  ctx.fill();
  ctx.globalAlpha /= 0.15;
  ctx.setLineDash([Math.max(2, width * 0.35), Math.max(2, width * 0.25)]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const reach = Math.hypot(dx, dy);
  const trim = length / 2;
  if (reach <= trim * 2) return;
  const ux = dx / reach;
  const uy = dy / reach;
  const startX = from.x + ux * trim;
  const startY = from.y + uy * trim;
  const tipX = to.x - ux * trim;
  const tipY = to.y - uy * trim;
  const head = Math.max(4, width * 0.6);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(tipX - ux * head * 0.6, tipY - uy * head * 0.6);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - ux * head - uy * head * 0.6,
    tipY - uy * head + ux * head * 0.6
  );
  ctx.lineTo(
    tipX - ux * head + uy * head * 0.6,
    tipY - uy * head - ux * head * 0.6
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

/** Seconds ahead a diving car's ghost is drawn. */
export const GHOST_AHEAD_S = 0.8;

/** Our own strips, one per side, drawn once our car is. */
export const ourStrips = { left: 0, right: 0 };

/** Warning arcs are drawn after the fade, so they are kept here till then. */
const rimWarnings: RimWarning[] = [];
let rimWarningCount = 0;

export const resetRimWarnings = () => {
  rimWarningCount = 0;
};

/** The queued warning at `index`, below `rimWarningTotal()`. */
export const rimWarningAt = (index: number): RimWarning => rimWarnings[index];
export const rimWarningTotal = () => rimWarningCount;

export const queueRimWarning = (
  carLengthPx: number,
  color: string,
  alpha: number,
  arcStyle: RadarArcStyle,
  minDeg: number,
  maxDeg: number,
  urgency: number
) => {
  const warning = rimWarnings[rimWarningCount] ?? ({} as RimWarning);
  warning.x = pose.x;
  warning.y = pose.y;
  warning.carLengthPx = carLengthPx;
  warning.color = color;
  warning.alpha = alpha;
  warning.arcStyle = arcStyle;
  warning.minDeg = minDeg;
  warning.maxDeg = maxDeg;
  warning.urgency = urgency;
  rimWarnings[rimWarningCount] = warning;
  rimWarningCount += 1;
};

/** A mark on the rim in the direction of a rival, as wide as the car looks. */
export const drawWarningArc = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  warning: RimWarning,
  style: RadarStyle
) => {
  const dx = warning.x - centre;
  const dy = warning.y - centre;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const bearing = Math.atan2(dy, dx);
  const minArc = (warning.minDeg * Math.PI) / 180;
  const maxArc = (Math.max(warning.maxDeg, warning.minDeg) * Math.PI) / 180;
  const half = Math.min(
    maxArc,
    Math.max(minArc, Math.atan2(warning.carLengthPx / 2, distance))
  );
  paintRimArc(
    ctx,
    centre,
    radius,
    bearing,
    half,
    warning.color,
    warning.arcStyle,
    warning.urgency,
    arcThicknessPx(radius, style.arcThickness)
  );
};
