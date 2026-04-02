import { getColor } from '@irdashies/utils/colors';
import { TrackDrawing, TrackDriver, TurnLabels } from './TrackCanvas';

export const getActiveSectorIndex = (
  playerProgress: number,
  sectorBoundaries: number[]
): number => {
  for (let i = 0; i < sectorBoundaries.length - 1; i++) {
    if (
      playerProgress >= sectorBoundaries[i] &&
      playerProgress < sectorBoundaries[i + 1]
    ) {
      return i;
    }
  }
  return sectorBoundaries.length - 2;
};

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
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = trackOutlineWidth;
    ctx.stroke(path2DObjects.inside);
  }

  ctx.strokeStyle = trackColor;
  ctx.lineWidth = trackLineWidth;
  ctx.stroke(path2DObjects.inside);
};

export const getTrackProgressLength = (
  progress: number,
  pathTotalLength: number,
  startFinishLength = 0,
  direction: 'clockwise' | 'anticlockwise' | null = 'anticlockwise'
) => {
  const adjustedLength = (pathTotalLength * progress) % pathTotalLength;

  if (direction === 'clockwise') {
    return (
      (startFinishLength - adjustedLength + pathTotalLength) % pathTotalLength
    );
  }

  return (startFinishLength + adjustedLength) % pathTotalLength;
};

export const getSectorPathRange = (
  startProgress: number,
  endProgress: number,
  pathTotalLength: number,
  startFinishLength = 0,
  direction: 'clockwise' | 'anticlockwise' | null = 'anticlockwise'
) => {
  const startLength = getTrackProgressLength(
    startProgress,
    pathTotalLength,
    startFinishLength,
    direction
  );
  const endLength = getTrackProgressLength(
    endProgress,
    pathTotalLength,
    startFinishLength,
    direction
  );

  if (direction === 'clockwise') {
    return {
      startLength: endLength,
      endLength: startLength,
      needsWrap: endLength > startLength,
    };
  }

  return {
    startLength,
    endLength,
    needsWrap: startLength > endLength,
  };
};

export const getSectorGapDimensions = (
  trackLineWidth: number,
  trackOutlineWidth: number
) => ({
  gapLength: trackOutlineWidth + 4,
  gapThickness: Math.max(4, trackLineWidth * 0.4),
});

export const buildSectorPath = (
  ctx: CanvasRenderingContext2D,
  trackPathPoints: { x: number; y: number }[],
  cumulativeLengths: number[],
  sLen: number,
  eLen: number,
  wrap: boolean
): boolean => {
  ctx.beginPath();
  let started = false;

  const appendRange = (rangeStart: number, rangeEnd: number) => {
    let startedRange = false;

    for (let j = 0; j < trackPathPoints.length - 1; j++) {
      const segStart = cumulativeLengths[j];
      const segEnd = cumulativeLengths[j + 1];
      const segLength = segEnd - segStart;
      if (!segLength) continue;
      if (!(segEnd > rangeStart && segStart < rangeEnd)) continue;

      const p1 = trackPathPoints[j];
      const p2 = trackPathPoints[j + 1];
      const clipStartRatio = Math.max(0, (rangeStart - segStart) / segLength);
      const clipEndRatio = Math.min(1, (rangeEnd - segStart) / segLength);
      const x1 = p1.x + (p2.x - p1.x) * clipStartRatio;
      const y1 = p1.y + (p2.y - p1.y) * clipStartRatio;
      const x2 = p1.x + (p2.x - p1.x) * clipEndRatio;
      const y2 = p1.y + (p2.y - p1.y) * clipEndRatio;

      if (!startedRange) {
        ctx.moveTo(x1, y1);
        startedRange = true;
        started = true;
      }

      ctx.lineTo(x2, y2);
    }
  };

  if (wrap) {
    const totalLength = cumulativeLengths[cumulativeLengths.length - 1];
    appendRange(sLen, totalLength);
    appendRange(0, eLen);
  } else {
    appendRange(sLen, eLen);
  }

  return started;
};

const getPointAndPerpendicular = (
  trackPathPoints: { x: number; y: number }[],
  cumulativeLengths: number[],
  pathTotalLength: number,
  pct: number,
  startFinishLength: number,
  direction: 'clockwise' | 'anticlockwise' | null
) => {
  const targetLength = getTrackProgressLength(
    pct,
    pathTotalLength,
    startFinishLength,
    direction
  );
  const adjustedPct = targetLength / pathTotalLength;

  for (let i = 0; i < trackPathPoints.length - 1; i++) {
    const segStart = cumulativeLengths[i];
    const segEnd = cumulativeLengths[i + 1];
    if (targetLength >= segStart && targetLength < segEnd) {
      const segLength = segEnd - segStart;
      const ratio = segLength > 0 ? (targetLength - segStart) / segLength : 0;
      const p1 = trackPathPoints[i];
      const p2 = trackPathPoints[i + 1];
      const x = p1.x + (p2.x - p1.x) * ratio;
      const y = p1.y + (p2.y - p1.y) * ratio;

      const prevIdx = Math.max(0, i - 1);
      const nextIdx = Math.min(trackPathPoints.length - 1, i + 2);
      const prev = trackPathPoints[prevIdx];
      const next = trackPathPoints[nextIdx];
      const tangentX = next.x - prev.x;
      const tangentY = next.y - prev.y;
      const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      if (tangentLen === 0) return null;
      const perpX = -tangentY / tangentLen;
      const perpY = tangentX / tangentLen;

      return { x, y, perpX, perpY, adjustedPct };
    }
  }
  return null;
};

export const drawSectorGaps = (
  ctx: CanvasRenderingContext2D,
  trackPathPoints: { x: number; y: number }[] | undefined,
  sectorBoundaries: number[] | null,
  trackLineWidth: number,
  trackOutlineWidth: number,
  startFinishLength?: number,
  direction?: 'clockwise' | 'anticlockwise' | null
) => {
  if (!trackPathPoints || !sectorBoundaries || sectorBoundaries.length < 2)
    return;

  const cumulativeLengths = [0];
  for (let i = 0; i < trackPathPoints.length - 1; i++) {
    const p1 = trackPathPoints[i];
    const p2 = trackPathPoints[i + 1];
    const segLength = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    cumulativeLengths.push(cumulativeLengths[i] + segLength);
  }

  const pathTotalLength = cumulativeLengths[cumulativeLengths.length - 1];
  if (!pathTotalLength) return;

  const { gapLength, gapThickness } = getSectorGapDimensions(
    trackLineWidth,
    trackOutlineWidth
  );

  for (const pct of sectorBoundaries) {
    const point = getPointAndPerpendicular(
      trackPathPoints,
      cumulativeLengths,
      pathTotalLength,
      pct,
      startFinishLength ?? 0,
      direction ?? 'anticlockwise'
    );
    if (!point) continue;

    if (
      Math.abs(point.adjustedPct) < 0.001 ||
      Math.abs(point.adjustedPct - 1) < 0.001
    ) {
      continue;
    }

    const startX = point.x - point.perpX * (gapLength / 2);
    const startY = point.y - point.perpY * (gapLength / 2);
    const endX = point.x + point.perpX * (gapLength / 2);
    const endY = point.y + point.perpY * (gapLength / 2);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = gapThickness;
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }
};

export const drawActiveSector = (
  ctx: CanvasRenderingContext2D,
  trackPathPoints: { x: number; y: number }[] | undefined,
  sectorBoundaries: number[] | null,
  activeSectorIndex: number,
  trackLineWidth: number,
  trackOutlineWidth: number,
  invertTrackColors: boolean,
  startFinishLength?: number,
  direction?: 'clockwise' | 'anticlockwise' | null
) => {
  if (!trackPathPoints || !sectorBoundaries) return;
  if (activeSectorIndex < 0 || activeSectorIndex >= sectorBoundaries.length - 1)
    return;

  const cumulativeLengths = [0];
  for (let i = 0; i < trackPathPoints.length - 1; i++) {
    const p1 = trackPathPoints[i];
    const p2 = trackPathPoints[i + 1];
    const segLength = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    cumulativeLengths.push(cumulativeLengths[i] + segLength);
  }

  const pathTotalLength = cumulativeLengths[cumulativeLengths.length - 1];
  if (!pathTotalLength) return;

  const startPct = sectorBoundaries[activeSectorIndex];
  const endPct = sectorBoundaries[activeSectorIndex + 1];
  if (endPct === undefined) return;
  const { startLength, endLength, needsWrap } = getSectorPathRange(
    startPct,
    endPct,
    pathTotalLength,
    startFinishLength ?? 0,
    direction ?? 'anticlockwise'
  );

  const activeLineWidth = trackLineWidth + 6;
  const activeOutlineWidth = trackOutlineWidth + 12;

  const outlineColor = invertTrackColors ? 'white' : 'black';
  const trackColor = invertTrackColors ? 'black' : 'white';

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  if (
    !buildSectorPath(
      ctx,
      trackPathPoints,
      cumulativeLengths,
      startLength,
      endLength,
      needsWrap
    )
  ) {
    ctx.restore();
    return;
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = activeOutlineWidth;
  ctx.stroke();

  buildSectorPath(
    ctx,
    trackPathPoints,
    cumulativeLengths,
    startLength,
    endLength,
    needsWrap
  );
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = activeLineWidth;
  ctx.stroke();

  ctx.restore();
};

export const drawStartFinishLine = (
  ctx: CanvasRenderingContext2D,
  startFinishLine: {
    point: { x: number; y: number };
    perpendicular: { x: number; y: number };
  } | null,
  trackLineWidth: number
) => {
  if (!startFinishLine) return;

  const lineLength = trackLineWidth * 3;
  const { point: sfPoint, perpendicular } = startFinishLine;

  const startX = sfPoint.x - (perpendicular.x * lineLength) / 2;
  const startY = sfPoint.y - (perpendicular.y * lineLength) / 2;
  const endX = sfPoint.x + (perpendicular.x * lineLength) / 2;
  const endY = sfPoint.y + (perpendicular.y * lineLength) / 2;

  ctx.lineWidth = trackLineWidth;
  ctx.strokeStyle = getColor('red');
  ctx.lineCap = 'square';

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

    const isNumeric = /^\d+/.test(content.trim());
    if (turnLabels.labelType === 'numbers' && !isNumeric) return;
    if (turnLabels.labelType === 'names' && isNumeric) return;

    let yOffset = 0;
    if (!isNumeric) {
      const neighbour = drawnPositions.find((pos) => {
        const dx = pos.x - x;
        const dy = pos.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });
      if (neighbour) {
        yOffset =
          (neighbour.y <= y ? 15 : -15) * (turnLabels.labelFontSize / 100);
      }
    }

    const renderX = x;
    const renderY = y + yOffset;
    drawnPositions.push({ x: renderX, y: renderY });

    const fontSize = 2 * (turnLabels.labelFontSize / 100);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}rem sans-serif`;
    const m = ctx.measureText(content);

    if (turnLabels.highContrast) {
      const padding = 20;
      const textWidth = m.width;
      const textHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const rectW = textWidth + padding;
      const rectH = textHeight + padding;
      const rectX = renderX - rectW / 2;
      const rectY = renderY - rectH / 2;
      const radius = Math.min(20, rectW / 2, rectH / 2);
      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, radius);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
    }

    ctx.fillStyle = 'white';
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
  driversOffTrack: boolean[],
  driverCircleSize: number,
  playerCircleSize: number,
  trackmapFontSize: number,
  showCarNumbers: boolean,
  displayMode: 'carNumber' | 'sessionPosition' | 'livePosition' = 'carNumber',
  driverLivePositions: Record<number, number>,
  carIdxIsOnPitRoad?: number[]
) => {
  Object.values(calculatePositions)
    .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
    .forEach(({ driver, position, isPlayer, sessionPosition }) => {
      let color = driverColors[driver.CarIdx];
      if (!color) return;

      const circleRadius = isPlayer ? playerCircleSize : driverCircleSize;
      const fontSize = circleRadius * (trackmapFontSize / 100);

      const onPitRoad = !!carIdxIsOnPitRoad?.[driver.CarIdx];
      if (onPitRoad) {
        color = { fill: '#999999', text: 'white' };
      }

      ctx.fillStyle = color.fill;
      ctx.beginPath();
      ctx.arc(position.x, position.y, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      if (driversOffTrack[driver.CarIdx]) {
        ctx.strokeStyle = getColor('yellow', 400);
        ctx.lineWidth = 10;
        ctx.stroke();
      }

      if (showCarNumbers) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color.text;
        ctx.font = `${fontSize}px sans-serif`;
        let displayText = '';
        if (onPitRoad) {
          displayText = 'P';
        } else if (displayMode === 'livePosition') {
          const livePosition =
            driverLivePositions[driver.CarIdx] ?? sessionPosition;
          displayText =
            livePosition && livePosition > 0 ? livePosition.toString() : '';
        } else if (displayMode === 'sessionPosition') {
          displayText =
            sessionPosition && sessionPosition > 0
              ? sessionPosition.toString()
              : '';
        } else {
          displayText = driver.CarNumber;
        }
        if (displayText) {
          const m = ctx.measureText(displayText);
          const visualOffset =
            (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
          ctx.fillText(displayText, position.x, position.y + visualOffset);
        }
      }
    });
};
