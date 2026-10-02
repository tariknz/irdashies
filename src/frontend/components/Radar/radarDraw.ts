import { RadarProjector, type ScreenPose } from './radarProjection';
import type { TrackGeometry } from '@irdashies/domain/track';

export interface RadarDrawCar {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  /** Metres from our line, positive to the left. */
  lateral: number;
  offTrack: boolean;
  fill: string;
  textColor: string;
  label: string;
}

export interface RadarStyle {
  range: number;
  carLength: number;
  carWidth: number;
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

export interface RadarScene {
  /** CSS pixels of the square the radar fills. */
  size: number;
  geometry: TrackGeometry | null;
  trackLength: number;
  playerPct: number;
  cars: readonly RadarDrawCar[];
  style: RadarStyle;
}

/** How far past the rim the road is drawn, so it never ends inside the disc. */
const ROAD_OVERSCAN = 1.5;
const ROAD_STEP_M = 1;
const MIN_LABEL_PX = 8;

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
  ctx.fillStyle = `rgba(15, 23, 42, ${style.backgroundOpacity / 100})`;
  ctx.fill();
  ctx.clip();

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

  // Furthest first, so the nearest car is drawn on top.
  for (let index = scene.cars.length - 1; index >= 0; index -= 1) {
    const car = scene.cars[index];
    projector.project(car.dist, car.lateral, pose);
    ctx.globalAlpha = car.offTrack ? 0.45 : 1;
    drawCarBody(ctx, pose.x, pose.y, pose.angle, length, width, car.fill);
    if (showLabels) {
      ctx.fillStyle = car.textColor;
      ctx.fillText(car.label, pose.x, pose.y);
    }
  }
  ctx.globalAlpha = 1;

  drawCarBody(
    ctx,
    centre,
    centre,
    -Math.PI / 2,
    length,
    width,
    style.playerColor
  );

  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.stroke();
};
