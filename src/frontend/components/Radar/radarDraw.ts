import { RadarProjector, type ScreenPose } from './radarProjection';
import type { TrackGeometry } from '@irdashies/domain/track';

export interface RadarDrawCar {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  /** Metres from our line, positive to the left. */
  lateral: number;
  offTrack: boolean;
  /** Body size in metres. */
  length: number;
  width: number;
  fill: string;
  textColor: string;
  label: string;
}

export type WarningLevel = 'none' | 'close' | 'alongside';

/**
 * How worried to be about a rival: alongside once the bodies overlap along
 * the track, close inside `cautionDistance` metres of bumper-to-bumper gap.
 */
export const warningLevel = (
  dist: number,
  carLength: number,
  playerLength: number,
  cautionDistance: number
): WarningLevel => {
  const gap = Math.abs(dist) - (carLength + playerLength) / 2;
  if (gap <= 0) return 'alongside';
  if (gap < cautionDistance) return 'close';
  return 'none';
};

export interface RadarStyle {
  range: number;
  /** Our car's body size in metres; also used for the pace car. */
  carLength: number;
  carWidth: number;
  showWarnings: boolean;
  /** Metres of bumper gap below which a rival counts as close. */
  cautionDistance: number;
  showCarNumbers: boolean;
  showTrackMap: boolean;
  trackWidth: number;
  /** 0-100 */
  mapOpacity: number;
  showRings: boolean;
  ringSpacing: number;
  playerColor: string;
  /** 0-100 */
  backgroundOpacity: number;
}

/** The car to line up behind while pacing. */
export interface RadarDrawFollow {
  /** Car index, or null for the pace car (which is not in `cars`). */
  carIdx: number | null;
  dist: number;
  label: string;
}

export interface RadarScene {
  /** CSS pixels of the square the radar fills. */
  size: number;
  geometry: TrackGeometry | null;
  trackLength: number;
  playerPct: number;
  cars: readonly RadarDrawCar[];
  follow: RadarDrawFollow | null;
  style: RadarStyle;
  /** Seconds, for the pulse on cars alongside. */
  time: number;
}

const FOLLOW_COLOR = '#22c55e';
const CLOSE_COLOR = '#f59e0b';
const ALONGSIDE_COLOR = '#ef4444';
const PULSE_HZ = 2.5;
const MIN_ARC_DEG = 6;
const MAX_ARC_DEG = 18;
const PACE_CAR_FILL = '#e2e8f0';

/** How far past the rim the road is drawn, so it never ends inside the disc. */
const ROAD_OVERSCAN = 1.5;
const ROAD_STEP_M = 1;
const MIN_LABEL_PX = 8;
/** Share of the radius where the picture starts fading out towards the rim. */
const FADE_START = 0.7;

const projector = new RadarProjector();
const pose: ScreenPose = { x: 0, y: 0, angle: 0 };

const drawRoad = (
  ctx: CanvasRenderingContext2D,
  style: RadarStyle,
  pixelsPerMetre: number
) => {
  const reach = style.range * ROAD_OVERSCAN;
  ctx.beginPath();
  for (let dist = -reach; dist <= reach; dist += ROAD_STEP_M) {
    projector.project(dist, 0, pose);
    if (dist === -reach) ctx.moveTo(pose.x, pose.y);
    else ctx.lineTo(pose.x, pose.y);
  }
  const opacity = style.mapOpacity / 100;
  const roadWidth = style.trackWidth * pixelsPerMetre;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.strokeStyle = `rgba(226, 232, 240, ${opacity})`;
  ctx.lineWidth = roadWidth;
  ctx.stroke();
  ctx.strokeStyle = `rgba(71, 85, 105, ${opacity})`;
  ctx.lineWidth = Math.max(roadWidth - Math.max(2, pixelsPerMetre * 0.4), 1);
  ctx.stroke();
};

const drawRings = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  style: RadarStyle,
  pixelsPerMetre: number
) => {
  if (style.ringSpacing <= 0) return;
  const fontSize = Math.max(MIN_LABEL_PX, Math.round(radius / 14));
  ctx.font = `${fontSize}px Lato, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 1;
  for (
    let metres = style.ringSpacing;
    metres < style.range - 0.01;
    metres += style.ringSpacing
  ) {
    const ringRadius = metres * pixelsPerMetre;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.arc(centre, centre, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
    ctx.fillText(`${metres}m`, centre, centre - ringRadius - 1);
  }
};

const drawCarBody = (
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

const drawFollowOutline = (
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
const drawFollowPointer = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  follow: RadarDrawFollow
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

  const fontSize = Math.max(MIN_LABEL_PX, Math.round(radius / 11));
  ctx.font = `bold ${fontSize}px Lato, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelDistance = radius - size - fontSize * 1.2;
  const text = `${follow.label} ${Math.round(Math.abs(follow.dist))}m`.trim();
  ctx.fillStyle = FOLLOW_COLOR;
  ctx.fillText(
    text,
    centre + Math.cos(bearing) * labelDistance,
    centre + Math.sin(bearing) * labelDistance
  );
};

const drawWarningOutline = (
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

interface RimWarning {
  x: number;
  y: number;
  carLengthPx: number;
  color: string;
  alpha: number;
}

/** Warning arcs are drawn after the fade, so they are kept here till then. */
const rimWarnings: RimWarning[] = [];
let rimWarningCount = 0;

const queueRimWarning = (carLengthPx: number, color: string, alpha: number) => {
  const warning = rimWarnings[rimWarningCount] ?? ({} as RimWarning);
  warning.x = pose.x;
  warning.y = pose.y;
  warning.carLengthPx = carLengthPx;
  warning.color = color;
  warning.alpha = alpha;
  rimWarnings[rimWarningCount] = warning;
  rimWarningCount += 1;
};

/** An arc on the rim in the direction of a rival, as wide as the car looks. */
const drawWarningArc = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  { x, y, carLengthPx, color }: RimWarning
) => {
  const dx = x - centre;
  const dy = y - centre;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const bearing = Math.atan2(dy, dx);
  const minArc = (MIN_ARC_DEG * Math.PI) / 180;
  const maxArc = (MAX_ARC_DEG * Math.PI) / 180;
  const half = Math.min(
    maxArc,
    Math.max(minArc, Math.atan2(carLengthPx / 2, distance))
  );
  const thickness = Math.max(4, radius * 0.07);
  ctx.beginPath();
  ctx.arc(
    centre,
    centre,
    radius - thickness / 2,
    bearing - half,
    bearing + half
  );
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineCap = 'butt';
};

export const drawRadar = (ctx: CanvasRenderingContext2D, scene: RadarScene) => {
  const { size, style } = scene;
  const centre = size / 2;
  const radius = size / 2 - 1;
  const pixelsPerMetre = radius / style.range;
  projector.setup(
    scene.geometry,
    scene.trackLength,
    scene.playerPct,
    centre,
    centre,
    pixelsPerMetre
  );

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.clip();
  rimWarningCount = 0;

  if (style.showTrackMap) drawRoad(ctx, style, pixelsPerMetre);
  if (style.showRings) drawRings(ctx, centre, radius, style, pixelsPerMetre);

  const length = style.carLength * pixelsPerMetre;
  const width = style.carWidth * pixelsPerMetre;
  const labelSize = Math.round(Math.min(width * 0.85, length * 0.5));
  const showLabels = style.showCarNumbers && labelSize >= MIN_LABEL_PX;
  if (showLabels) {
    ctx.font = `bold ${labelSize}px Lato, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  const pulse =
    0.55 + 0.45 * (0.5 + 0.5 * Math.sin(scene.time * PULSE_HZ * 2 * Math.PI));

  // Furthest first, so the nearest car is drawn on top.
  for (let index = scene.cars.length - 1; index >= 0; index -= 1) {
    const car = scene.cars[index];
    const carLength = car.length * pixelsPerMetre;
    const carWidth = car.width * pixelsPerMetre;
    projector.project(car.dist, car.lateral, pose);
    ctx.globalAlpha = car.offTrack ? 0.45 : 1;
    drawCarBody(ctx, pose.x, pose.y, pose.angle, carLength, carWidth, car.fill);
    if (showLabels) {
      ctx.fillStyle = car.textColor;
      ctx.fillText(car.label, pose.x, pose.y);
    }
    ctx.globalAlpha = 1;

    if (!style.showWarnings) continue;
    const level = warningLevel(
      car.dist,
      car.length,
      style.carLength,
      style.cautionDistance
    );
    if (level === 'none') continue;
    const color = level === 'alongside' ? ALONGSIDE_COLOR : CLOSE_COLOR;
    ctx.globalAlpha = level === 'alongside' ? pulse : 0.9;
    drawWarningOutline(ctx, carLength, carWidth, color);
    queueRimWarning(carLength, color, ctx.globalAlpha);
    ctx.globalAlpha = 1;
  }

  const { follow } = scene;
  const followBeyondRange = !!follow && Math.abs(follow.dist) > style.range;
  if (follow && !followBeyondRange) {
    projector.project(follow.dist, 0, pose);
    const car = scene.cars.find((c) => c.carIdx === follow.carIdx);
    if (car) {
      projector.project(car.dist, car.lateral, pose);
      drawFollowOutline(
        ctx,
        car.length * pixelsPerMetre,
        car.width * pixelsPerMetre
      );
    } else {
      drawCarBody(
        ctx,
        pose.x,
        pose.y,
        pose.angle,
        length,
        width,
        PACE_CAR_FILL
      );
      if (showLabels) {
        ctx.fillStyle = '#0f172a';
        ctx.fillText(
          follow.carIdx === null ? 'PC' : follow.label,
          pose.x,
          pose.y
        );
      }
      drawFollowOutline(ctx, length, width);
    }
  }

  drawCarBody(
    ctx,
    centre,
    centre,
    -Math.PI / 2,
    length,
    width,
    style.playerColor
  );

  // Fade everything drawn so far towards the rim, then slide the background
  // in underneath, so cars ease in and out at the edge of the range.
  const fade = ctx.createRadialGradient(
    centre,
    centre,
    radius * FADE_START,
    centre,
    centre,
    radius
  );
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(15, 23, 42, ${style.backgroundOpacity / 100})`;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Rim markers stay at full strength above the fade.
  for (let index = 0; index < rimWarningCount; index += 1) {
    const warning = rimWarnings[index];
    ctx.globalAlpha = warning.alpha;
    drawWarningArc(ctx, centre, radius, warning);
  }
  ctx.globalAlpha = 1;
  if (follow && followBeyondRange) {
    projector.project(follow.dist, 0, pose);
    drawFollowPointer(ctx, centre, radius, follow);
  }

  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.stroke();
};
