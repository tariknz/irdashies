import { getColor } from '@irdashies/utils/colors';
import { TrackDrawing, TrackDriver } from './TrackCanvas';

export const setupCanvasContext = (
  ctx: CanvasRenderingContext2D,
  scale: number,
  offsetX: number,
  offsetY: number
) => {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Apply shadow (now efficient thanks to canvas caching)
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
};

export const drawTrack = (
  ctx: CanvasRenderingContext2D,
  path2DObjects: { inside: Path2D | null },
  invertTrackColors: boolean,
  trackLineWidth: number,
  trackOutlineWidth: number
) => {
  if (!path2DObjects.inside) return;

  const outlineColor = invertTrackColors ? 'white' : 'black';
  const trackColor = invertTrackColors ? 'black' : 'white';

  // Draw outline first
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = trackOutlineWidth;
  ctx.stroke(path2DObjects.inside);

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
  enableTurnNames: boolean | undefined,
  highContrastTurns: boolean,
  trackmapFontSize: number
) => {
  if (!enableTurnNames || !turns) return;

  turns.forEach((turn) => {
    if (!turn.content || !turn.x || !turn.y) return;
    const fontSize = 2 * (trackmapFontSize / 100);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}rem sans-serif`;
    // measure text      
    const m = ctx.measureText(turn.content); 
    if (highContrastTurns) {      
      const padding = 20;
      const textWidth = m.width;
      const textHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const rectX = turn.x - textWidth / 2 - padding / 2;
      const rectY = turn.y - textHeight / 2 - padding / 2;
      const rectW = textWidth + padding;
      const rectH = textHeight + padding;      
      const radius = Math.min(20, rectW / 2, rectH / 2);
      // rounded rect
      ctx.beginPath();
      ctx.moveTo(rectX + radius, rectY);
      ctx.arcTo(rectX + rectW, rectY, rectX + rectW, rectY + rectH, radius);
      ctx.arcTo(rectX + rectW, rectY + rectH, rectX, rectY + rectH, radius);
      ctx.arcTo(rectX, rectY + rectH, rectX, rectY, radius);
      ctx.arcTo(rectX, rectY, rectX + rectW, rectY, radius);
      ctx.closePath();
      // fill rect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();          
    } 
    ctx.fillStyle = 'white';     
    // visual offset
    const visualOffset = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(turn.content, turn.x, turn.y + visualOffset);
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
) => {

  Object.values(calculatePositions)
    .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer)) // draws player last to be on top
    .forEach(({ driver, position, isPlayer, sessionPosition }) => {
      let color = driverColors[driver.CarIdx];
      if (!color) return;

      const circleRadius = isPlayer ? playerCircleSize : driverCircleSize;
      const fontSize = circleRadius * (trackmapFontSize / 100);

      const onPitRoad = !!(carIdxIsOnPitRoad && carIdxIsOnPitRoad[driver.CarIdx] === 1);
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
          const livePosition = driverLivePositions[driver.CarIdx];
          displayText =
            livePosition && livePosition > 0
              ? livePosition.toString()
              : '';
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
          const visualOffset = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
          ctx.fillText(displayText, position.x, position.y + visualOffset);
        }
      }
    });
};
