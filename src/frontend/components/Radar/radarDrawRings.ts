import type { RadarStyle } from './radarDrawTypes';
import { formatDistance } from './radarStyle';
import { MIN_TEXT_PX } from './radarDrawShared';

export const GUIDE_STROKE = 'rgba(148, 163, 184, 0.35)';
export const GUIDE_DASH = [4, 4];

export const drawRadarRings = (
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

/** One static layer owned by a RadarDisplay drawing effect, never a history. */
export class RadarRingsLayer {
  private canvas: HTMLCanvasElement | undefined;
  private size = -1;
  private range = -1;
  private spacing = -1;
  private metric: boolean | undefined;
  private readonly fonts =
    typeof document === 'undefined' ? undefined : document.fonts;
  private readonly invalidate = () => {
    this.size = -1;
  };

  constructor(
    private readonly pixelRatio: number,
    private readonly createCanvas = () => document.createElement('canvas')
  ) {
    this.fonts?.addEventListener('loadingdone', this.invalidate);
    this.fonts?.addEventListener('loadingerror', this.invalidate);
  }

  dispose(): void {
    this.fonts?.removeEventListener('loadingdone', this.invalidate);
    this.fonts?.removeEventListener('loadingerror', this.invalidate);
  }

  draw(ctx: CanvasRenderingContext2D, size: number, style: RadarStyle): void {
    if (style.ringSpacing <= 0) return;
    const centre = size / 2;
    const radius = centre - 1;
    const pixelsPerMetre = radius / style.range;
    if (
      this.size !== size ||
      this.range !== style.range ||
      this.spacing !== style.ringSpacing ||
      this.metric !== style.metric
    ) {
      const canvas = (this.canvas ??= this.createCanvas());
      canvas.width = canvas.height = Math.round(size * this.pixelRatio);
      const cacheCtx = canvas.getContext('2d');
      if (!cacheCtx) {
        drawRadarRings(ctx, centre, radius, style, pixelsPerMetre);
        return;
      }
      cacheCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      drawRadarRings(cacheCtx, centre, radius, style, pixelsPerMetre);
      this.size = size;
      this.range = style.range;
      this.spacing = style.ringSpacing;
      this.metric = style.metric;
    }
    // Copy device pixels 1:1, including fractional DPR/widget-scale ratios.
    // The caller's existing device-space disc clip stays in effect.
    const canvas = this.canvas;
    if (!canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    // Preserve the context state left by the uncached ring draw for later layers.
    ctx.font = `${Math.max(MIN_TEXT_PX, Math.round(radius / 14))}px Lato, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 1;
    if (style.ringSpacing < style.range - 0.01) {
      ctx.strokeStyle = GUIDE_STROKE;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
    }
  }
}
