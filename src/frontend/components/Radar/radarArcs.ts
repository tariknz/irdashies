import type { RadarArcStyle } from '@irdashies/types';

/** Segments in the `segments` style; they light from the middle out. */
const SEGMENTS = 3;
const SEGMENT_ORDER = [1, 0, 2];
/** Share of each segment's span left as the gap after it. */
const SEGMENT_GAP = 0.18;
/** Unlit segments are still faintly drawn, so the scale reads. */
const SEGMENT_DIM = 0.22;
/** How deep the glow reaches inward, in arc thicknesses. */
const GLOW_DEPTH = 3.2;
/** The glow spreads a little past the span, its ends being soft. */
const GLOW_SPREAD = 1.2;
/** Where the sector starts fading in, as a share of the radius. */
const SECTOR_INNER = 0.15;

/** `#rrggbb` with an alpha byte appended; other colours are left alone. */
const withAlpha = (color: string, alpha: number): string => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const byte = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return `${color}${byte.toString(16).padStart(2, '0')}`;
};

/**
 * Marks the rim towards `bearing` (radians, canvas angles). `half` is the
 * half-span in radians and `urgency` (0-1) how many segments light in the
 * `segments` style; the other styles show urgency through span and colour.
 * The caller sets globalAlpha for pulsing.
 */
export const paintRimArc = (
  ctx: CanvasRenderingContext2D,
  centre: number,
  radius: number,
  bearing: number,
  half: number,
  color: string,
  style: RadarArcStyle,
  urgency: number,
  thickness: number
) => {
  ctx.save();
  if (style === 'segments') {
    const gap = (2 * half * SEGMENT_GAP) / SEGMENTS;
    const span = (2 * half - gap * (SEGMENTS - 1)) / SEGMENTS;
    const lit = Math.max(1, Math.round(urgency * SEGMENTS));
    const alpha = ctx.globalAlpha;
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    for (let index = 0; index < SEGMENTS; index += 1) {
      const start = bearing - half + SEGMENT_ORDER[index] * (span + gap);
      ctx.beginPath();
      ctx.arc(centre, centre, radius - thickness / 2, start, start + span);
      ctx.globalAlpha = index < lit ? alpha : alpha * SEGMENT_DIM;
      ctx.stroke();
    }
  } else if (style === 'glow') {
    const depth = thickness * GLOW_DEPTH;
    const spread = half * GLOW_SPREAD;
    const glow = ctx.createRadialGradient(
      centre,
      centre,
      Math.max(radius - depth, 0),
      centre,
      centre,
      radius
    );
    glow.addColorStop(0, withAlpha(color, 0));
    glow.addColorStop(1, withAlpha(color, 0.9));
    ctx.beginPath();
    ctx.arc(centre, centre, radius, bearing - spread, bearing + spread);
    ctx.arc(
      centre,
      centre,
      Math.max(radius - depth, 0),
      bearing + spread,
      bearing - spread,
      true
    );
    ctx.closePath();
    ctx.fillStyle = glow;
    ctx.fill();
  } else if (style === 'sector') {
    const wedge = ctx.createRadialGradient(
      centre,
      centre,
      radius * SECTOR_INNER,
      centre,
      centre,
      radius
    );
    wedge.addColorStop(0, withAlpha(color, 0));
    wedge.addColorStop(1, withAlpha(color, 0.4));
    ctx.beginPath();
    ctx.moveTo(centre, centre);
    ctx.arc(centre, centre, radius, bearing - half, bearing + half);
    ctx.closePath();
    ctx.fillStyle = wedge;
    ctx.fill();
    // A thin edge on the rim, so the wedge has a clear end.
    const edge = Math.max(2, thickness * 0.4);
    ctx.beginPath();
    ctx.arc(centre, centre, radius - edge / 2, bearing - half, bearing + half);
    ctx.lineWidth = edge;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(
      centre,
      centre,
      radius - thickness / 2,
      bearing - half,
      bearing + half
    );
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.restore();
};

/** Thickness of a rim arc in px for `percent` of the radius. */
export const arcThicknessPx = (radius: number, percent: number) =>
  Math.max(3, (radius * percent) / 100);
