import { RadarProjector, type ScreenPose } from './radarProjection';
import type { TrackGeometry } from '@irdashies/domain/track';
import { overlapOf, type DiveHint } from './radarHints';
import type { RadarArcStyle, RadarHazardKind } from '@irdashies/types';
import { arcThicknessPx, paintRimArc } from './radarArcs';

export interface RadarDrawCar {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  /** Metres from our line, positive to the left. */
  lateral: number;
  /** Rate of change of `dist` in m/s. */
  closingSpeed: number;
  /** Lane from the spotter, for the debug labels. */
  lane: number;
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
  warningArcs: boolean;
  warningArcStyle: RadarArcStyle;
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
  /** Share of the radius, 0-100, over which the picture fades out at the rim. */
  edgeFade: number;
  showCrosshair: boolean;
  /** Run the dashes of the line ahead/behind past at our speed. */
  axisMotion: boolean;
  /** Metres of each moving dash; the gaps are twice as long. */
  axisDashLength: number;
  /** Speed of the moving dashes, % of our own. */
  axisSpeed: number;
  closeColor: string;
  alongsideColor: string;
  /** Pulses per second on cars alongside; 0 keeps them steady. */
  pulseHz: number;
  arcMinDeg: number;
  arcMaxDeg: number;
  /** Rim arc thickness, % of the radius. */
  arcThickness: number;
  showOverlap: boolean;
  /** Share of a car's length from which the overlap strip turns red. */
  overlapThreshold: number;
  overlapShowPercent: boolean;
  diveGhost: boolean;
  diveShowClosing: boolean;
  diveArcs: boolean;
  diveArcStyle: RadarArcStyle;
  diveArcMinDeg: number;
  diveArcMaxDeg: number;
  showHazards: boolean;
  /** Metres ahead a hazard is shown from. */
  hazardRange: number;
  /** Metres under which a hazard flashes. */
  hazardBlinkDistance: number;
  hazardCrash: boolean;
  hazardSlow: boolean;
  hazardOff: boolean;
  hazardShowSpeed: boolean;
  hazardArcs: boolean;
  hazardArcStyle: RadarArcStyle;
  hazardArcMinDeg: number;
  hazardArcMaxDeg: number;
  /** Car numbers are left out on cars drawn smaller than this, in px. */
  minLabelPx: number;
  debugLabels: boolean;
  showFrameTime: boolean;
}

/** The car to line up behind while pacing. */
export interface RadarDrawFollow {
  /** Car index, or null for the pace car (which is not in `cars`). */
  carIdx: number | null;
  dist: number;
  label: string;
}

/** A car in trouble ahead, already filtered by the hazard settings. */
export interface RadarDrawHazard {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  kind: RadarHazardKind;
  /** Its own speed in m/s. */
  speed: number;
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
  /** Metres we have driven, for the moving dashes. */
  travelled: number;
  /** Milliseconds the previous frame took, for the dev readout. */
  frameMs?: number;
  /** Cars coming up fast behind, by car index. */
  dives?: ReadonlyMap<number, DiveHint>;
  /** Metres between lane centres, to place a diving car's ghost. */
  laneWidth?: number;
  /** Cars in trouble ahead, nearest first. */
  hazards?: readonly RadarDrawHazard[];
}

const FOLLOW_COLOR = '#22c55e';
const DEBUG_COLOR = '#fbbf24';
const PACE_CAR_FILL = '#e2e8f0';

/** How far past the rim the road is drawn, so it never ends inside the disc. */
const ROAD_OVERSCAN = 1.5;
const ROAD_STEP_M = 1;
/** Smallest ring label and pointer text, whatever the label setting. */
const MIN_TEXT_PX = 8;

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

const GUIDE_STROKE = 'rgba(148, 163, 184, 0.35)';
const GUIDE_DASH = [4, 4];

/** Dash and gap of the moving line, in metres, so it runs at true speed. */
const axisDash = (style: RadarStyle, pixelsPerMetre: number) => {
  const dash = Math.max(style.axisDashLength, 0.5) * pixelsPerMetre;
  return [dash, dash * 2];
};

/**
 * Dashed lines through our car, ahead/behind and left/right. With motion on,
 * the dashes of the line ahead/behind slide back past us like road markings.
 */
const drawCrosshair = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  style: RadarStyle,
  pixelsPerMetre: number,
  travelled: number
) => {
  ctx.lineWidth = 1;
  ctx.strokeStyle = GUIDE_STROKE;
  ctx.setLineDash(GUIDE_DASH);
  ctx.beginPath();
  ctx.moveTo(centre - radius, centre);
  ctx.lineTo(centre + radius, centre);
  ctx.stroke();

  if (style.axisMotion) {
    const pattern = axisDash(style, pixelsPerMetre);
    const period = pattern[0] + pattern[1];
    const moved = travelled * (style.axisSpeed / 100) * pixelsPerMetre;
    ctx.setLineDash(pattern);
    // Drawn top to bottom: a negative offset carries the dashes downwards.
    ctx.lineDashOffset = -(moved % period);
  }
  ctx.beginPath();
  ctx.moveTo(centre, centre - radius);
  ctx.lineTo(centre, centre + radius);
  ctx.stroke();
  ctx.lineDashOffset = 0;
  ctx.setLineDash([]);
};

const drawRings = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  style: RadarStyle,
  pixelsPerMetre: number
) => {
  if (style.ringSpacing <= 0) return;
  const fontSize = Math.max(MIN_TEXT_PX, Math.round(radius / 14));
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
    ctx.strokeStyle = GUIDE_STROKE;
    ctx.setLineDash(GUIDE_DASH);
    ctx.beginPath();
    ctx.arc(centre, centre, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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

  const fontSize = Math.max(MIN_TEXT_PX, Math.round(radius / 11));
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
const drawOverlapStrip = (
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
const drawHintText = (
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
const drawOverlapPercent = (
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

const ghostPose: ScreenPose = { x: 0, y: 0, angle: 0 };

/** Dashed outline where a diving car is headed, and an arrow to it. */
const drawDiveGhost = (
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
const GHOST_AHEAD_S = 0.8;

/** Our own strips, one per side, drawn once our car is. */
const ourStrips = { left: 0, right: 0 };

/** Warning arcs are drawn after the fade, so they are kept here till then. */
const rimWarnings: RimWarning[] = [];
let rimWarningCount = 0;

const queueRimWarning = (
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

interface DebugLabel {
  x: number;
  y: number;
  text: string;
}

/** Written last, so the fade does not swallow them. */
const debugLabels: DebugLabel[] = [];
let debugLabelCount = 0;

const queueDebugLabel = (text: string, carWidthPx: number) => {
  const label = debugLabels[debugLabelCount] ?? ({} as DebugLabel);
  label.x = pose.x + carWidthPx / 2 + 3;
  label.y = pose.y;
  label.text = text;
  debugLabels[debugLabelCount] = label;
  debugLabelCount += 1;
};

const drawDebug = (
  ctx: CanvasRenderingContext2D,
  size: number,
  style: RadarStyle,
  frameMs: number | undefined
) => {
  ctx.font = `${MIN_TEXT_PX + 2}px monospace`;
  ctx.fillStyle = DEBUG_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (style.debugLabels) {
    for (let index = 0; index < debugLabelCount; index += 1) {
      const label = debugLabels[index];
      ctx.fillText(label.text, label.x, label.y);
    }
  }
  if (style.showFrameTime && frameMs !== undefined) {
    ctx.textAlign = 'center';
    ctx.fillText(`${frameMs.toFixed(2)} ms`, size / 2, size - 14);
  }
};

/** A mark on the rim in the direction of a rival, as wide as the car looks. */
const drawWarningArc = (
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

const HAZARD_YELLOW = '#facc15';
const HAZARD_LABELS: Record<RadarHazardKind, string> = {
  crash: 'CRASH',
  slow: 'SLOW',
  off: 'OFF',
  rejoin: 'REJOIN',
};
/** Flashes per second of a near hazard. */
const HAZARD_FLASH_HZ = 2;
/** A crashed car is drawn turned across the road, as wrecks usually are. */
const CRASH_TILT = 1.1;
/** Furthest from straight ahead a rim marker may sit, so it never points back. */
const HAZARD_MAX_BEARING = (100 * Math.PI) / 180;

const hazardColor = (kind: RadarHazardKind, style: RadarStyle): string =>
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
  if (!style.showHazards || hazard.dist > style.hazardRange) return false;
  if (hazard.kind === 'crash') return style.hazardCrash;
  if (hazard.kind === 'slow') return style.hazardSlow;
  return style.hazardOff;
};

/**
 * Off the track is steady: the car is out of the way. Everything else
 * flashes once it is near, and a car coming back on flashes at any distance.
 */
const hazardFlashes = (hazard: RadarDrawHazard, style: RadarStyle) =>
  hazard.kind === 'rejoin' ||
  (hazard.kind !== 'off' && hazard.dist < style.hazardBlinkDistance);

/** Warning triangle with an exclamation mark, centred on (x, y). */
const drawHazardTriangle = (
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
const drawHazardMarker = (
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
    `${HAZARD_LABELS[hazard.kind]} ${Math.round(hazard.dist)}m`,
    labelX,
    labelY,
    color,
    fontSize,
    'center'
  );
  if (style.hazardShowSpeed) {
    drawHintText(
      ctx,
      `${Math.round(hazard.speed * 3.6)} km/h`,
      labelX,
      labelY + fontSize * 1.15,
      '#e2e8f0',
      Math.max(MIN_TEXT_PX, fontSize - 2),
      'center'
    );
  }
};

/** Outline, triangle and speed on a hazard car drawn on the disc. */
const drawHazardOnCar = (
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
      `${Math.round(hazard.speed * 3.6)} km/h`,
      pose.x + outward * reach,
      pose.y,
      color,
      fontSize,
      outward > 0 ? 'left' : 'right'
    );
  }
};

const hazardOf = (
  hazards: readonly RadarDrawHazard[] | undefined,
  carIdx: number
): RadarDrawHazard | undefined => {
  if (!hazards) return undefined;
  for (const hazard of hazards) {
    if (hazard.carIdx === carIdx) return hazard;
  }
  return undefined;
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
  debugLabelCount = 0;

  if (style.showTrackMap) drawRoad(ctx, style, pixelsPerMetre);
  if (style.showCrosshair) {
    drawCrosshair(ctx, centre, radius, style, pixelsPerMetre, scene.travelled);
  }
  if (style.showRings) drawRings(ctx, centre, radius, style, pixelsPerMetre);

  const length = style.carLength * pixelsPerMetre;
  const width = style.carWidth * pixelsPerMetre;
  const labelSize = Math.round(Math.min(width * 0.85, length * 0.5));
  const showLabels = style.showCarNumbers && labelSize >= style.minLabelPx;
  if (showLabels) {
    ctx.font = `bold ${labelSize}px Lato, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  const pulse =
    style.pulseHz > 0
      ? 0.55 +
        0.45 * (0.5 + 0.5 * Math.sin(scene.time * style.pulseHz * 2 * Math.PI))
      : 1;

  const flash =
    0.35 +
    0.65 * (0.5 + 0.5 * Math.sin(scene.time * HAZARD_FLASH_HZ * 2 * Math.PI));

  const hintFont = Math.max(MIN_TEXT_PX + 1, Math.round(radius / 12));
  ourStrips.left = 0;
  ourStrips.right = 0;

  // Furthest first, so the nearest car is drawn on top.
  for (let index = scene.cars.length - 1; index >= 0; index -= 1) {
    const car = scene.cars[index];
    const carLength = car.length * pixelsPerMetre;
    const carWidth = car.width * pixelsPerMetre;
    projector.project(car.dist, car.lateral, pose);
    const hazard = hazardOf(scene.hazards, car.carIdx);
    if (hazard?.kind === 'crash') pose.angle += CRASH_TILT;
    ctx.globalAlpha = car.offTrack ? 0.45 : 1;
    drawCarBody(ctx, pose.x, pose.y, pose.angle, carLength, carWidth, car.fill);
    if (showLabels) {
      ctx.fillStyle = car.textColor;
      ctx.fillText(car.label, pose.x, pose.y);
    }
    ctx.globalAlpha = 1;
    if (hazard) {
      drawHazardOnCar(
        ctx,
        hazard,
        carLength,
        carWidth,
        style,
        flash,
        hintFont,
        centre
      );
      // The triangle changed the font; put the car-number one back.
      if (showLabels) {
        ctx.font = `bold ${labelSize}px Lato, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      if (hazard.kind === 'crash') pose.angle -= CRASH_TILT;
    }
    if (style.debugLabels) {
      queueDebugLabel(
        `#${car.carIdx} L${car.lane > 0 ? '+' : ''}${car.lane}`,
        carWidth
      );
    }

    if (style.showOverlap && Math.abs(car.lane) >= 0.5) {
      const overlap = overlapOf(car.dist, car.length, style.carLength);
      if (overlap?.onRival) {
        // We attack: measured on its side facing us.
        const side = Math.sign(car.lateral);
        const color =
          overlap.share >= style.overlapThreshold
            ? style.alongsideColor
            : style.closeColor;
        drawOverlapStrip(
          ctx,
          pose.x,
          pose.y,
          pose.angle,
          carLength,
          carWidth,
          side,
          overlap.share,
          style.overlapThreshold,
          color
        );
        if (style.overlapShowPercent) {
          drawOverlapPercent(
            ctx,
            pose.x,
            pose.y,
            pose.angle,
            carLength,
            carWidth,
            side,
            overlap.share,
            color,
            hintFont
          );
        }
      } else if (overlap) {
        const key = car.lateral > 0 ? 'left' : 'right';
        ourStrips[key] = Math.max(ourStrips[key], overlap.share);
      }
    }

    const dive = scene.dives?.get(car.carIdx);
    let diveArcCar = -1;
    if (dive) {
      const level = warningLevel(
        car.dist,
        car.length,
        style.carLength,
        style.cautionDistance
      );
      const carX = pose.x;
      const carY = pose.y;
      if (dive.level === 'dive') {
        ghostPose.x = pose.x;
        ghostPose.y = pose.y;
        ghostPose.angle = pose.angle;
        const ghostDist = Math.min(
          car.dist + (dive.closingKmh / 3.6) * GHOST_AHEAD_S,
          0
        );
        projector.project(
          ghostDist,
          -dive.side * (scene.laneWidth ?? style.carWidth + 0.7),
          pose
        );
        ctx.globalAlpha = pulse;
        if (style.diveGhost && dive.side !== 0) {
          drawDiveGhost(
            ctx,
            ghostPose,
            pose,
            carLength,
            carWidth,
            style.alongsideColor
          );
        }
        if (dive.side === 0) {
          // No side to point at: warn where the car is.
          pose.x = ghostPose.x;
          pose.y = ghostPose.y;
        }
        if (style.diveArcs) {
          queueRimWarning(
            carLength,
            style.alongsideColor,
            pulse,
            style.diveArcStyle,
            style.diveArcMinDeg,
            style.diveArcMaxDeg,
            1
          );
          diveArcCar = car.carIdx;
        }
        ctx.globalAlpha = 1;
      } else if (level === 'none') {
        if (style.diveArcs) {
          queueRimWarning(
            carLength,
            style.closeColor,
            0.9,
            style.diveArcStyle,
            style.diveArcMinDeg,
            style.diveArcMaxDeg,
            1 / 3
          );
        }
      }
      if (style.diveShowClosing) {
        const color =
          dive.level === 'dive' ? style.alongsideColor : style.closeColor;
        const text =
          dive.level === 'dive'
            ? `+${Math.round(dive.closingKmh)} ${dive.secondsToSide.toFixed(1)}s`
            : `+${Math.round(dive.closingKmh)}`;
        // On the side away from where it is heading.
        const away = dive.side < 0 ? 1 : dive.side > 0 ? -1 : 1;
        drawHintText(
          ctx,
          text,
          carX + away * (carWidth / 2 + 4),
          carY,
          color,
          hintFont,
          away > 0 ? 'left' : 'right'
        );
      }
      projector.project(car.dist, car.lateral, pose);
    }

    if (!style.showWarnings) continue;
    const level = warningLevel(
      car.dist,
      car.length,
      style.carLength,
      style.cautionDistance
    );
    if (level === 'none') continue;
    const color =
      level === 'alongside' ? style.alongsideColor : style.closeColor;
    ctx.globalAlpha = level === 'alongside' ? pulse : 0.9;
    drawWarningOutline(ctx, carLength, carWidth, color);
    // A diving car already has the more urgent arc of the two.
    if (style.warningArcs && diveArcCar !== car.carIdx) {
      queueRimWarning(
        carLength,
        color,
        ctx.globalAlpha,
        style.warningArcStyle,
        style.arcMinDeg,
        style.arcMaxDeg,
        level === 'alongside' ? 1 : 2 / 3
      );
    }
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
  for (const key of ['left', 'right'] as const) {
    const share = ourStrips[key];
    if (share <= 0) continue;
    // Our car points up, so its left is the local -y side.
    const side = key === 'left' ? -1 : 1;
    const color =
      share >= style.overlapThreshold ? style.alongsideColor : style.closeColor;
    drawOverlapStrip(
      ctx,
      centre,
      centre,
      -Math.PI / 2,
      length,
      width,
      side,
      share,
      style.overlapThreshold,
      color
    );
    if (style.overlapShowPercent) {
      drawOverlapPercent(
        ctx,
        centre,
        centre,
        -Math.PI / 2,
        length,
        width,
        side,
        share,
        color,
        hintFont
      );
    }
  }

  // Slide the background in underneath, then fade the whole disc towards
  // the rim, so cars and the disc itself ease out at the edge of the range.
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(15, 23, 42, ${style.backgroundOpacity / 100})`;
  ctx.fillRect(0, 0, size, size);
  const fadeShare = Math.min(Math.max(style.edgeFade, 0), 100) / 100;
  if (fadeShare > 0) {
    const fade = ctx.createRadialGradient(
      centre,
      centre,
      radius * (1 - fadeShare),
      centre,
      centre,
      radius
    );
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Rim markers stay at full strength above the fade.
  for (let index = 0; index < rimWarningCount; index += 1) {
    const warning = rimWarnings[index];
    ctx.globalAlpha = warning.alpha;
    drawWarningArc(ctx, centre, radius, warning, style);
  }
  ctx.globalAlpha = 1;
  if (follow && followBeyondRange) {
    projector.project(follow.dist, 0, pose);
    drawFollowPointer(ctx, centre, radius, follow);
  }
  const hazards = scene.hazards;
  if (hazards && hazards.length > 0) {
    // Nearest first, so the first one past the rim is the one to show.
    let beyond = -1;
    let others = 0;
    for (let index = 0; index < hazards.length; index += 1) {
      if (hazards[index].dist <= style.range) continue;
      if (beyond < 0) beyond = index;
      else others += 1;
    }
    if (beyond >= 0) {
      drawHazardMarker(
        ctx,
        centre,
        radius,
        hazards[beyond],
        others,
        style,
        flash
      );
    }
  }
  if (style.debugLabels || style.showFrameTime) {
    drawDebug(ctx, size, style, scene.frameMs);
  }

  ctx.restore();
};
