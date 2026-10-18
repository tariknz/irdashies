import type { RadarHazardKind } from '@irdashies/types';
import type { RadarDrawHazard, RadarStyle } from './radarDrawTypes';
import { MIN_TEXT_PX, pose, projector } from './radarDrawShared';
import { arcThicknessPx, paintRimArc } from './radarArcs';
import { drawHintText, drawWarningOutline } from './radarDrawWarnings';
import { formatDistance, speedIn, speedUnit } from './radarStyle';

export const HAZARD_YELLOW = '#facc15';
export const HAZARD_LABELS: Record<RadarHazardKind, string> = {
  crash: 'CRASH',
  slow: 'SLOW',
  off: 'OFF',
  rejoin: 'REJOIN',
};
/** Flashes per second of a near hazard. */
export const HAZARD_FLASH_HZ = 2;
/** A crashed car is drawn turned across the road, as wrecks usually are. */
export const CRASH_TILT = 1.1;
/** Furthest from straight ahead a rim marker may sit, so it never points back. */
export const HAZARD_MAX_BEARING = (100 * Math.PI) / 180;

export const hazardColor = (
  kind: RadarHazardKind,
  style: RadarStyle
): string =>
  kind === 'crash'
    ? style.alongsideColor
    : kind === 'slow'
      ? style.closeColor
      : HAZARD_YELLOW;

/** Whether this hazard is wanted at all, with the settings given. */
export const hazardWanted = (
  hazard: { dist: number; kind: RadarHazardKind },
  style: Pick<
    RadarStyle,
    'showHazards' | 'hazardRange' | 'hazardCrash' | 'hazardSlow' | 'hazardOff'
  >
): boolean => {
  if (
    !style.showHazards ||
    hazard.dist < 0 ||
    hazard.dist > style.hazardRange
  ) {
    return false;
  }
  if (hazard.kind === 'crash') return style.hazardCrash;
  if (hazard.kind === 'slow') return style.hazardSlow;
  return style.hazardOff;
};

/**
 * Off the track is steady: the car is out of the way. Everything else
 * flashes once it is near, and a car coming back on flashes at any distance.
 */
export const hazardFlashes = (hazard: RadarDrawHazard, style: RadarStyle) =>
  hazard.kind === 'rejoin' ||
  (hazard.kind !== 'off' && hazard.dist < style.hazardBlinkDistance);

/** Warning triangle with an exclamation mark, centred on (x, y). */
export const drawHazardTriangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) => {
  const height = size * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y - height * 0.6);
  ctx.lineTo(x + size / 2, y + height * 0.4);
  ctx.lineTo(x - size / 2, y + height * 0.4);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
  ctx.font = `bold ${Math.round(size * 0.6)}px Lato, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('!', x, y + height * 0.1);
};

/**
 * A hazard beyond the disc: an arc and a triangle on the rim in its
 * direction along the track map, with what it is and how far. Both grow as
 * it nears; `others` more hazards beyond the rim are counted beside it.
 */
export const drawHazardMarker = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  hazard: RadarDrawHazard,
  others: number,
  style: RadarStyle,
  flash: number
) => {
  projector.project(hazard.dist, 0, pose);
  let bearing = Math.atan2(pose.y - centre, pose.x - centre);
  // Measured from straight up, then kept in front of us.
  let fromUp = bearing + Math.PI / 2;
  if (fromUp > Math.PI) fromUp -= Math.PI * 2;
  fromUp = Math.min(Math.max(fromUp, -HAZARD_MAX_BEARING), HAZARD_MAX_BEARING);
  bearing = fromUp - Math.PI / 2;

  const span = Math.max(style.hazardRange - style.range, 1);
  const near = Math.min(
    Math.max((style.hazardRange - hazard.dist) / span, 0),
    1
  );
  const color = hazardColor(hazard.kind, style);
  ctx.globalAlpha = hazardFlashes(hazard, style) ? flash : 1;

  const minArc = style.hazardArcMinDeg;
  const maxArc = Math.max(style.hazardArcMaxDeg, minArc);
  const half = ((minArc + (maxArc - minArc) * near) * Math.PI) / 180;
  // Without the arc the triangle moves out to the rim in its place.
  const thickness = style.hazardArcs
    ? arcThicknessPx(radius, style.arcThickness)
    : 2;
  if (style.hazardArcs) {
    paintRimArc(
      ctx,
      centre,
      radius,
      bearing,
      half,
      color,
      style.hazardArcStyle,
      near,
      thickness
    );
  }

  const size = radius * (0.12 + 0.06 * near);
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  const triangleAt = radius - thickness - size * 0.75;
  drawHazardTriangle(
    ctx,
    centre + cos * triangleAt,
    centre + sin * triangleAt,
    size,
    color
  );
  ctx.globalAlpha = 1;

  const fontSize = Math.max(MIN_TEXT_PX, Math.round(radius / 11));
  if (others > 0) {
    drawHintText(
      ctx,
      `+${others}`,
      centre + cos * triangleAt + size * 0.6,
      centre + sin * triangleAt - size * 0.4,
      '#e2e8f0',
      Math.max(MIN_TEXT_PX, fontSize - 2),
      'left'
    );
  }
  const labelAt = triangleAt - size * 0.6 - fontSize;
  const labelX = centre + cos * labelAt;
  const labelY = centre + sin * labelAt;
  drawHintText(
    ctx,
    style.hazardShowLabel
      ? `${HAZARD_LABELS[hazard.kind]} ${formatDistance(hazard.dist, style.metric)}`
      : formatDistance(hazard.dist, style.metric),
    labelX,
    labelY,
    color,
    fontSize,
    'center'
  );
  if (style.hazardShowSpeed) {
    drawHintText(
      ctx,
      `${speedIn(hazard.speed, style.metric)} ${speedUnit(style.metric)}`,
      labelX,
      labelY + fontSize * 1.15,
      '#e2e8f0',
      Math.max(MIN_TEXT_PX, fontSize - 2),
      'center'
    );
  }
};

/** Outline, triangle and speed on a hazard car drawn on the disc. */
export const drawHazardOnCar = (
  ctx: CanvasRenderingContext2D,
  hazard: RadarDrawHazard,
  carLength: number,
  carWidth: number,
  style: RadarStyle,
  flash: number,
  fontSize: number,
  centre: number
) => {
  const color = hazardColor(hazard.kind, style);
  ctx.globalAlpha = hazardFlashes(hazard, style) ? flash : 1;
  drawWarningOutline(ctx, carLength, carWidth, color);
  // On the car itself: beside it, it would leave the disc near the rim.
  drawHazardTriangle(ctx, pose.x, pose.y, Math.max(12, fontSize * 1.8), color);
  ctx.globalAlpha = 1;
  if (style.hazardShowSpeed) {
    // On the side away from our line, where the other cars are not.
    const outward = pose.x >= centre ? 1 : -1;
    const reach = Math.max(carLength, carWidth) / 2 + 4;
    drawHintText(
      ctx,
      `${speedIn(hazard.speed, style.metric)} ${speedUnit(style.metric)}`,
      pose.x + outward * reach,
      pose.y,
      color,
      fontSize,
      outward > 0 ? 'left' : 'right'
    );
  }
};

export const hazardOf = (
  hazards: readonly RadarDrawHazard[] | undefined,
  carIdx: number
): RadarDrawHazard | undefined => {
  if (!hazards) return undefined;
  for (const hazard of hazards) {
    if (hazard.carIdx === carIdx) return hazard;
  }
  return undefined;
};
