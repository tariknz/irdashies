import { drawPoleSideNotice } from './radarDrawNotice';
import { overlapOf } from './radarHints';
import { formatDistance, speedIn } from './radarStyle';
import { warningLevel } from './radarDrawTypes';
import type { RadarScene, RadarStyle } from './radarDrawTypes';

import { MIN_TEXT_PX, drawCarBody, pose, projector } from './radarDrawShared';
import {
  GHOST_AHEAD_S,
  drawDiveGhost,
  drawHintText,
  drawOverlapPercent,
  drawOverlapStrip,
  drawWarningArc,
  drawWarningOutline,
  ghostPose,
  ourStrips,
  queueRimWarning,
  resetRimWarnings,
  rimWarningAt,
  rimWarningTotal,
} from './radarDrawWarnings';
import {
  CRASH_TILT,
  HAZARD_FLASH_HZ,
  drawHazardMarker,
  drawHazardOnCar,
  hazardOf,
} from './radarDrawHazards';
import { drawDebug, queueDebugLabel, resetDebugLabels } from './radarDrawDebug';
import {
  PACE_CAR_FILL,
  drawFollowLine,
  drawFollowOutline,
  drawFollowPointer,
} from './radarDrawFollow';

export * from './radarDrawTypes';
export { followLineEnds } from './radarDrawFollow';
export { hazardWanted } from './radarDrawHazards';

/** How far past the rim the road is drawn, so it never ends inside the disc. */
const ROAD_OVERSCAN = 1.5;
const ROAD_STEP_M = 1;

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
    ctx.fillText(
      formatDistance(metres, style.metric),
      centre,
      centre - ringRadius - 1
    );
  }
};

/** Our own overlap strips, one per side, with our car pointing up. */
const drawOurStrips = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  length: number,
  width: number,
  style: RadarStyle,
  hintFont: number
) => {
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
};

/** Slides the background in underneath and fades the disc to the rim. */
const drawBackdrop = (
  ctx: CanvasRenderingContext2D,
  size: number,
  centre: number,
  radius: number,
  style: RadarStyle
) => {
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
  resetRimWarnings();
  resetDebugLabels();

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

    const level = warningLevel(
      car.dist,
      car.length,
      style.carLength,
      style.cautionDistance
    );
    const dive = scene.dives?.get(car.carIdx);
    let diveArcCar = -1;
    if (dive) {
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
        const closing = speedIn(dive.closingKmh / 3.6, style.metric);
        const text =
          dive.level === 'dive'
            ? `+${closing} ${dive.secondsToSide.toFixed(1)}s`
            : `+${closing}`;
        // On the side away from where it is heading.
        const away = dive.side > 0 ? -1 : 1;
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
    if (level === 'none') continue;
    const color =
      level === 'alongside' ? style.alongsideColor : style.closeColor;
    ctx.globalAlpha = level === 'alongside' ? pulse : 0.9;
    drawWarningOutline(ctx, carLength, carWidth, color);
    // Alongside has the overlap strip; a diving or hazard car already has
    // its own text on that side.
    if (
      style.showGapLabel &&
      level === 'close' &&
      !(dive && style.diveShowClosing) &&
      !(hazard && style.hazardShowSpeed)
    ) {
      const gap = Math.abs(car.dist) - (car.length + style.carLength) / 2;
      // On the side away from our line, where the other cars are not.
      const outward = pose.x >= centre ? 1 : -1;
      drawHintText(
        ctx,
        formatDistance(gap, style.metric),
        pose.x + outward * (carWidth / 2 + 4),
        pose.y,
        color,
        hintFont,
        outward > 0 ? 'left' : 'right'
      );
    }
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
    const car = scene.cars.find((c) => c.carIdx === follow.carIdx);
    if (car) {
      projector.project(car.dist, car.lateral, pose);
      drawFollowLine(ctx, centre, pose, length, car.length * pixelsPerMetre);
      drawFollowOutline(
        ctx,
        car.length * pixelsPerMetre,
        car.width * pixelsPerMetre
      );
    } else {
      projector.project(follow.dist, 0, pose);
      drawFollowLine(ctx, centre, pose, length, length);
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
  drawOurStrips(ctx, centre, length, width, style, hintFont);

  drawBackdrop(ctx, size, centre, radius, style);

  // Rim markers stay at full strength above the fade.
  for (let index = 0; index < rimWarningTotal(); index += 1) {
    const warning = rimWarningAt(index);
    ctx.globalAlpha = warning.alpha;
    drawWarningArc(ctx, centre, radius, warning, style);
  }
  ctx.globalAlpha = 1;
  if (follow && followBeyondRange) {
    projector.project(follow.dist, 0, pose);
    drawFollowPointer(ctx, centre, radius, follow, style.metric);
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
  if (scene.poleSideNotice) {
    drawPoleSideNotice(ctx, size, scene.poleSideNotice);
  }
  if (style.debugLabels || style.showFrameTime) {
    drawDebug(ctx, size, style, scene.frameMs);
  }

  ctx.restore();
};
