import { getColor } from '@irdashies/utils/colors';
import { TrackDrawing, TrackDriver, TurnLabels } from './TrackCanvas';
import type { Sector } from '@irdashies/types';
import type { SectorColor } from '@irdashies/context';

export const setupCanvasContext = (
  ctx: CanvasRenderingContext2D,
  scale: number,
  offsetX: number,
  offsetY: number,
  isMinimal = false
) => {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (!isMinimal) {
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
};

export const drawTrack = (
  ctx: CanvasRenderingContext2D,
  path2DObjects: { inside: Path2D | null },
  invertTrackColors: boolean,
  trackLineWidth: number,
  trackOutlineWidth: number,
  isMinimal = false
) => {
  if (!path2DObjects.inside) return;

  const outlineColor = invertTrackColors ? 'white' : 'black';
  const trackColor = invertTrackColors ? 'black' : 'white';

  if (!isMinimal) {
    // Draw outline first
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = trackOutlineWidth;
    ctx.stroke(path2DObjects.inside);
  }

  // Draw track on top
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = trackLineWidth;
  ctx.stroke(path2DObjects.inside);
};

export const drawStartFinishLine = (
  ctx: CanvasRenderingContext2D,
  startFinishLine: {
    point: { x: number; y: number };
    perpendicular: { x: number; y: number };
  } | null
) => {
  if (!startFinishLine) return;

  const lineLength = 60; // Length of the start/finish line
  const { point: sfPoint, perpendicular } = startFinishLine;

  // Calculate the start and end points of the line
  const startX = sfPoint.x - (perpendicular.x * lineLength) / 2;
  const startY = sfPoint.y - (perpendicular.y * lineLength) / 2;
  const endX = sfPoint.x + (perpendicular.x * lineLength) / 2;
  const endY = sfPoint.y + (perpendicular.y * lineLength) / 2;

  ctx.lineWidth = 20;
  ctx.strokeStyle = getColor('red');
  ctx.lineCap = 'square';

  // Draw the perpendicular line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
};

export const drawTurnNames = (
  ctx: CanvasRenderingContext2D,
  turns: TrackDrawing['turns'],
  turnLabels: TurnLabels
) => {
  if (!turnLabels.enabled || !turns) return;

  const drawnPositions: { x: number; y: number }[] = [];

  turns.forEach((turn) => {
    const { x, y, content } = turn;
    if (!content || x === undefined || y === undefined) return;

    // type of display
    const isNumeric = /^\d+/.test(content.trim());
    if (turnLabels.labelType === 'numbers' && !isNumeric) return;
    if (turnLabels.labelType === 'names' && isNumeric) return;

    // proximity check to prevent overlap
    const scaleFactor = turnLabels.labelFontSize / 100;
    const proximityThreshold = 30 * scaleFactor;

    let yOffset = 0;
    if (!isNumeric) {
      const neighbour = drawnPositions.find((pos) => {
        const dx = pos.x - x;
        const dy = pos.y - y;
        return Math.sqrt(dx * dx + dy * dy) < proximityThreshold;
      });
      if (neighbour) {
        yOffset = (neighbour.y <= y ? 15 : -15) * scaleFactor;
      }
    }

    // update current coordinates with the offset
    const renderX = x;
    const renderY = y + yOffset;
    drawnPositions.push({ x: renderX, y: renderY });

    // add the label
    const fontSize = 2 * scaleFactor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}rem sans-serif`;
    const m = ctx.measureText(content);

    if (turnLabels.highContrast) {
      const padding = 20 * scaleFactor;
      const textWidth = m.width;
      const textHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const rectW = textWidth + padding;
      const rectH = textHeight + padding;
      const rectX = renderX - rectW / 2;
      const rectY = renderY - rectH / 2;
      const radius = Math.min(20 * scaleFactor, rectW / 2, rectH / 2);
      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, radius);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
    }

    ctx.fillStyle = 'white';
    // visual offset
    const visualOffset =
      (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(content, renderX, renderY + visualOffset);
  });
};

export const drawDrivers = (
  ctx: CanvasRenderingContext2D,
  calculatePositions: Record<
    number,
    TrackDriver & {
      position: { x: number; y: number };
      sessionPosition?: number;
    }
  >,
  driverColors: Record<number, { fill: string; text: string }>,
  invertLeaderColor: boolean,
  driversOffTrack: boolean[],
  driverCircleSize: number,
  playerCircleSize: number,
  trackmapFontSize: number,
  showCarNumbers: boolean,
  displayMode: 'carNumber' | 'sessionPosition' | 'livePosition' = 'carNumber',
  driverLivePositions: Record<number, number>,
  carIdxIsOnPitRoad?: number[],
  playerIconImage?: HTMLImageElement | null,
  hidePlayer?: boolean
) => {
  const safePosition = (pos: number | undefined): number =>
    pos !== undefined && isFinite(pos) ? pos : 0;
  Object.values(calculatePositions)
    .sort((a, b) => {
      const aOnPit = !!carIdxIsOnPitRoad?.[a.driver.CarIdx];
      const bOnPit = !!carIdxIsOnPitRoad?.[b.driver.CarIdx];
      if (aOnPit !== bOnPit) return aOnPit ? -1 : 1; // pit cars drawn first (under track drivers)
      if (a.isPlayer !== b.isPlayer) {
        return Number(a.isPlayer) - Number(b.isPlayer); // draws player last to be on top
      }
      return safePosition(b.sessionPosition) - safePosition(a.sessionPosition); // draws leader on top
    })
    .forEach(({ driver, position, isPlayer, sessionPosition }) => {
      let color = driverColors[driver.CarIdx];
      if (!color) return;

      if (isPlayer && hidePlayer) return;

      const circleRadius = isPlayer ? playerCircleSize : driverCircleSize;
      const fontSize = circleRadius * (trackmapFontSize / 100);
      const originalColor = color.fill;
      const livePosition =
        driverLivePositions[driver.CarIdx] ?? sessionPosition;

      // highlight leader?
      if (!isPlayer && invertLeaderColor && livePosition === 1) {
        color = { fill: 'white', text: originalColor };
      }

      // on pit road?
      const onPitRoad = !!carIdxIsOnPitRoad?.[driver.CarIdx];
      if (onPitRoad) {
        color = { fill: '#999999', text: 'white' };
      }

      const useIcon = isPlayer && !!playerIconImage && !onPitRoad;

      if (useIcon) {
        ctx.drawImage(
          playerIconImage as HTMLImageElement,
          position.x - circleRadius,
          position.y - circleRadius,
          circleRadius * 2,
          circleRadius * 2
        );
      } else {
        ctx.fillStyle = color.fill;
        ctx.beginPath();
        ctx.arc(position.x, position.y, circleRadius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // draw a border?
      if (driversOffTrack[driver.CarIdx]) {
        ctx.strokeStyle = getColor('yellow', 400);
        ctx.lineWidth = 10;
        if (useIcon) {
          ctx.beginPath();
          ctx.arc(position.x, position.y, circleRadius, 0, 2 * Math.PI);
        }
        ctx.stroke();
      } else if (
        !isPlayer &&
        !onPitRoad &&
        invertLeaderColor &&
        livePosition === 1
      ) {
        ctx.strokeStyle = originalColor;
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      if (showCarNumbers && !useIcon) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color.text;
        ctx.font = `${fontSize}px sans-serif`;
        const livePosition =
          driverLivePositions[driver.CarIdx] ?? sessionPosition;
        const displayText = onPitRoad
          ? 'P'
          : displayMode === 'livePosition'
            ? livePosition && livePosition > 0
              ? livePosition.toString()
              : ''
            : displayMode === 'sessionPosition'
              ? sessionPosition && sessionPosition > 0
                ? sessionPosition.toString()
                : ''
              : driver.CarNumber;
        if (displayText) {
          const m = ctx.measureText(displayText);
          const visualOffset =
            (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
          ctx.fillText(displayText, position.x, position.y + visualOffset);
        }
      }
    });
};

// ---------------------------------------------------------------------------
// Sector dividers
// ---------------------------------------------------------------------------

/**
 * Draw short perpendicular tick marks at each sector boundary on the track.
 * Skips sector 0 (that boundary is the S/F line, already drawn separately).
 */
export const drawSectorDividers = (
  ctx: CanvasRenderingContext2D,
  trackPathPoints: { x: number; y: number }[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise',
  sectors: Sector[],
  trackLineWidth: number
) => {
  if (trackPathPoints.length < 2 || sectors.length === 0) return;

  const n = trackPathPoints.length;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = trackLineWidth * 0.6;
  ctx.lineCap = 'square';

  for (const sector of sectors) {
    // Skip sector 0 — the S/F line is already rendered separately
    if (sector.SectorStartPct === 0) continue;

    const floatIdx = progressToFloatIndex(
      sector.SectorStartPct,
      trackPathPoints,
      totalLength,
      intersectionLength,
      direction
    );

    // Interpolated point on the track path at this boundary
    const idxFloor = Math.floor(floatIdx);
    const t = floatIdx - idxFloor;
    const p0 = trackPathPoints[idxFloor];
    const p1 = trackPathPoints[Math.min(idxFloor + 1, n - 1)];
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;

    // Tangent direction from surrounding points
    const prevIdx = Math.max(0, idxFloor - 1);
    const nextIdx = Math.min(n - 1, idxFloor + 2);
    const prev = trackPathPoints[prevIdx];
    const next = trackPathPoints[nextIdx];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    // Perpendicular to the tangent
    const px = -dy / len;
    const py = dx / len;

    const halfLen = trackLineWidth * 1.2;
    ctx.beginPath();
    ctx.moveTo(x - px * halfLen, y - py * halfLen);
    ctx.lineTo(x + px * halfLen, y + py * halfLen);
    ctx.stroke();
  }

  ctx.restore();
};

// ---------------------------------------------------------------------------
// Sector color map
// ---------------------------------------------------------------------------

const SECTOR_COLOR_HEX: Record<SectorColor | 'current', string | null> = {
  purple: '#a855f7',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  default: null, // falls back to base track color
  current: '#6b7280', // gray-500 — sector currently being driven
};

/**
 * Convert a lap-distance fraction (0–1 from S/F) to a float index into
 * trackPathPoints, applying the same offset/direction math used for drivers.
 */
function progressToFloatIndex(
  progress: number,
  trackPathPoints: { x: number; y: number }[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise'
): number {
  const adjustedLength = (totalLength * progress) % totalLength;
  const length =
    direction === 'anticlockwise'
      ? (intersectionLength + adjustedLength) % totalLength
      : (intersectionLength - adjustedLength + totalLength) % totalLength;
  return (length / totalLength) * (trackPathPoints.length - 1);
}

/**
 * Draw per-sector colored segments over the base track line.
 * Each sector uses a stroke width slightly wider than the track line so the
 * color is visible on top of the outline.
 *
 * Only draws sectors whose color is not 'default'.
 */
export const drawSectorColors = (
  ctx: CanvasRenderingContext2D,
  trackPathPoints: { x: number; y: number }[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise',
  sectors: Sector[],
  sectorColors: SectorColor[],
  trackLineWidth: number,
  currentSectorIdx?: number
) => {
  if (trackPathPoints.length < 2 || sectors.length === 0) return;

  const n = trackPathPoints.length;

  // Build sector boundary indices (float) in path-point space
  const boundaryIndices = sectors.map((s) =>
    progressToFloatIndex(
      s.SectorStartPct,
      trackPathPoints,
      totalLength,
      intersectionLength,
      direction
    )
  );

  ctx.save();
  ctx.lineWidth = trackLineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < sectors.length; i++) {
    const isCurrent = currentSectorIdx !== undefined && i === currentSectorIdx;
    const color = isCurrent ? 'current' : (sectorColors[i] ?? 'default');
    const hex = SECTOR_COLOR_HEX[color];
    if (!hex) continue; // skip 'default' sectors

    const startFloat = boundaryIndices[i];
    // Next sector boundary (wraps around for the last sector)
    const endFloat =
      i + 1 < sectors.length ? boundaryIndices[i + 1] : boundaryIndices[0];

    ctx.strokeStyle = hex;
    ctx.beginPath();

    // Interpolated start point (same formula for both directions)
    const startInt = Math.floor(startFloat);
    const t0 = startFloat - startInt;
    const p0 = trackPathPoints[startInt];
    const p1 = trackPathPoints[Math.min(startInt + 1, n - 1)];
    ctx.moveTo(p0.x + (p1.x - p0.x) * t0, p0.y + (p1.y - p0.y) * t0);

    if (direction !== 'clockwise') {
      // Anticlockwise: race progress maps to increasing path indices.
      // A sector wraps when endFloat < startFloat (last sector crosses the
      // array boundary from n-1 back to 0).
      const wraps = endFloat < startFloat;
      const endInt = wraps ? n - 1 : Math.ceil(endFloat);

      for (let j = startInt + 1; j <= endInt; j++) {
        ctx.lineTo(trackPathPoints[j].x, trackPathPoints[j].y);
      }

      if (wraps) {
        const endIntWrap = Math.ceil(endFloat);
        for (let j = 0; j <= endIntWrap; j++) {
          ctx.lineTo(trackPathPoints[j].x, trackPathPoints[j].y);
        }
      }
    } else {
      // Clockwise: race progress maps to DECREASING path indices.
      // A sector wraps when endFloat > startFloat (it crosses the array
      // boundary from 0 back to n-1).
      const wraps = endFloat > startFloat;
      const endInt = wraps ? 0 : Math.floor(endFloat);

      for (let j = startInt; j >= endInt; j--) {
        ctx.lineTo(trackPathPoints[j].x, trackPathPoints[j].y);
      }

      if (wraps) {
        const endIntWrap = Math.floor(endFloat);
        for (let j = n - 1; j >= endIntWrap; j--) {
          ctx.lineTo(trackPathPoints[j].x, trackPathPoints[j].y);
        }
      }
    }

    ctx.stroke();
  }

  ctx.restore();
};
