import { MIN_TEXT_PX } from './radarDrawShared';

const NOTICE_COLOR = '#f8fafc';
const NOTICE_BACKDROP = 'rgba(15, 23, 42, 0.8)';

/** Confirms a flipped pole side: a short label at the top of the radar. */
export const drawPoleSideNotice = (
  ctx: CanvasRenderingContext2D,
  size: number,
  side: 'left' | 'right'
) => {
  const fontSize = Math.max(MIN_TEXT_PX + 2, Math.round(size / 14));
  const text = side === 'left' ? 'POLE LEFT' : 'POLE RIGHT';
  ctx.save();
  ctx.font = `bold ${fontSize}px Lato, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + fontSize;
  const height = fontSize * 1.6;
  const x = size / 2;
  const y = size * 0.1 + height / 2;
  ctx.fillStyle = NOTICE_BACKDROP;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = NOTICE_COLOR;
  ctx.fillText(text, x, y);
  ctx.restore();
};
