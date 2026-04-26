import { getColor } from '@irdashies/utils/colors';
import { TrackDrawing, TrackDriver, TurnLabels } from './TrackCanvas';

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
  Object.values(calculatePositions)
    .sort((a, b) => {
      const aOnPit = !!carIdxIsOnPitRoad?.[a.driver.CarIdx];
      const bOnPit = !!carIdxIsOnPitRoad?.[b.driver.CarIdx];
      if (aOnPit !== bOnPit) return aOnPit ? -1 : 1; // pit cars drawn first (under track drivers)
      return Number(a.isPlayer) - Number(b.isPlayer); // player drawn last (on top)
    })
    .forEach(({ driver, position, isPlayer, sessionPosition }) => {
      let color = driverColors[driver.CarIdx];
      if (!color) return;

      if (isPlayer && hidePlayer) return;

      const circleRadius = isPlayer ? playerCircleSize : driverCircleSize;
      const fontSize = circleRadius * (trackmapFontSize / 100);

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

      if (driversOffTrack[driver.CarIdx]) {
        ctx.strokeStyle = getColor('yellow', 400);
        ctx.lineWidth = 10;
        if (useIcon) {
          ctx.beginPath();
          ctx.arc(position.x, position.y, circleRadius, 0, 2 * Math.PI);
        }
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
