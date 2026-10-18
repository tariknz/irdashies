import type { RadarStyle } from './radarDrawTypes';
import { MIN_TEXT_PX, pose } from './radarDrawShared';

const DEBUG_COLOR = '#fbbf24';

interface DebugLabel {
  x: number;
  y: number;
  text: string;
}

/** Written last, so the fade does not swallow them. */
const debugLabels: DebugLabel[] = [];
let debugLabelCount = 0;

export const resetDebugLabels = () => {
  debugLabelCount = 0;
};

export const queueDebugLabel = (text: string, carWidthPx: number) => {
  const label = debugLabels[debugLabelCount] ?? ({} as DebugLabel);
  label.x = pose.x + carWidthPx / 2 + 3;
  label.y = pose.y;
  label.text = text;
  debugLabels[debugLabelCount] = label;
  debugLabelCount += 1;
};

export const drawDebug = (
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
