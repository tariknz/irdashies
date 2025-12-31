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
  
  // Apply shadow
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
};

export const drawTrack = (
  ctx: CanvasRenderingContext2D,
  path2DObjects: { inside: Path2D | null }
) => {
  if (!path2DObjects.inside) return;

  // Draw black outline first
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 40;
  ctx.stroke(path2DObjects.inside);

  // Draw white track on top
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 20;
  ctx.stroke(path2DObjects.inside);
};

export const drawStartFinishLine = (
  ctx: CanvasRenderingContext2D,
  startFinishLine: { point: { x: number; y: number }; perpendicular: { x: number; y: number } } | null
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
  enableTurnNames: boolean | undefined
) => {
  if (!enableTurnNames || !turns) return;

  turns.forEach((turn) => {
    if (!turn.content || !turn.x || !turn.y) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.font = '2rem sans-serif';
    ctx.fillText(turn.content, turn.x, turn.y);
  });
};

export const drawDrivers = (
  ctx: CanvasRenderingContext2D,
  calculatePositions: Record<number, TrackDriver & { position: { x: number; y: number } }>,
  driverColors: Record<number, { fill: string; text: string }>,
  driversOffTrack: boolean[]
) => {
  Object.values(calculatePositions)
    .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer)) // draws player last to be on top
    .forEach(({ driver, position }) => {
      const color = driverColors[driver.CarIdx];
      if (!color) return;

      ctx.fillStyle = color.fill;
      ctx.beginPath();
      ctx.arc(position.x, position.y, 40, 0, 2 * Math.PI);
      ctx.fill();

      if (driversOffTrack[driver.CarIdx]) {
        ctx.strokeStyle = getColor('yellow', 400);
        ctx.lineWidth = 10;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color.text;
      ctx.font = '2rem sans-serif';
      ctx.fillText(driver.CarNumber, position.x, position.y);
    });
}; 