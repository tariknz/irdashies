import type { BundledTrackGeometry } from '../src/app/lmu/bundledTrackGeometry';
import {
  LmuDrawnLine,
  LmuTrackWidthProfile,
  storedTrackWidthFromBundle,
} from '../src/app/lmu/trackWidth';
import { buildWorldTrackMap } from '../src/app/lmu/worldTrack';

export const FALLBACK_ROAD_WIDTH_M = 12;
const LABEL_DISTANCES_IN_FONT_SIZES = [1.6, 2.8, 4.2];
const TURN_PROBE = 0.004;
const START_ARROW = [0.004, 0.016];

export interface TrackTurn {
  number?: number;
  name?: string;
  marker?: number;
  start?: number;
  end?: number;
}

export interface TrackSvgInput {
  trackName: string;
  geometry: BundledTrackGeometry;
  sectors?: readonly number[] | null;
  turns?: readonly TrackTurn[];
}

export interface TrackSvgResult {
  svg: string;
  hasWidth: boolean;
  medianWidthM: number | null;
  unknownBins: number;
  labels: number;
  sizeM: [number, number];
}

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const trackSvgFileName = (trackName: string): string =>
  `${
    trackName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'track'
  }.svg`;

const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

const medianOf = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const overlaps = (a: Box, b: Box): boolean =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

export function renderLmuTrackSvg(input: TrackSvgInput): TrackSvgResult {
  const { trackName, geometry } = input;
  const { world, lapDistM } = geometry;
  const { map, fit } = buildWorldTrackMap(
    world.track,
    world.offsetM,
    world.lapDistM
  );
  const line = new LmuDrawnLine(map.active.trackPathPoints, fit);
  const at = (pct: number, offset: number): Point => {
    const point = line.pointAt(wrap01(pct), offset, { x: 0, y: 0 });
    return { x: point.x, y: point.y };
  };

  let bins = 0;
  let left = new Float64Array(0);
  let right = new Float64Array(0);
  const stored = geometry.width
    ? storedTrackWidthFromBundle(geometry.width.width, line, lapDistM)
    : null;
  if (stored) {
    const profile = new LmuTrackWidthProfile();
    profile.reset(line, lapDistM);
    if (profile.seed(stored)) {
      bins = profile.binCount;
      left = new Float64Array(bins);
      right = new Float64Array(bins);
      profile.resolvedEdges(left, right);
    }
  }
  const hasWidth = bins > 0;
  const half = FALLBACK_ROAD_WIDTH_M / 2;
  const edgesAt = (pct: number): { l: number; r: number } => {
    if (!hasWidth) return { l: half, r: -half };
    const bin = Math.min(bins - 1, Math.floor(wrap01(pct) * bins));
    const l = left[bin];
    const r = right[bin];
    return Number.isFinite(l) && Number.isFinite(r)
      ? { l, r }
      : { l: half, r: -half };
  };

  const leftEdge: Point[] = [];
  const rightEdge: Point[] = [];
  const widths: number[] = [];
  let unknownBins = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    const pct = (bin + 0.5) / bins;
    if (!Number.isFinite(left[bin]) || !Number.isFinite(right[bin])) {
      unknownBins += 1;
      leftEdge.push(at(pct, half));
      rightEdge.push(at(pct, -half));
      continue;
    }
    leftEdge.push(at(pct, left[bin]));
    rightEdge.push(at(pct, right[bin]));
    widths.push(left[bin] - right[bin]);
  }

  const extentPoints = hasWidth
    ? [...leftEdge, ...rightEdge, ...world.track.pitLane]
    : [...world.track.racing, ...world.track.pitLane];
  const minX = Math.min(...extentPoints.map((p) => p.x));
  const maxX = Math.max(...extentPoints.map((p) => p.x));
  const minY = Math.min(...extentPoints.map((p) => p.y));
  const maxY = Math.max(...extentPoints.map((p) => p.y));
  const extent = Math.max(maxX - minX, maxY - minY);
  const fontSize = Math.max(18, extent / 80);
  const pad = fontSize * 6;
  const stroke = Math.max(1.5, extent / 1000);
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2 + fontSize * 2;
  const sx = (p: Point) => (p.x - minX + pad).toFixed(1);
  const sy = (p: Point) => (p.y - minY + pad).toFixed(1);
  const path = (points: readonly Point[], close: boolean) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${sx(p)},${sy(p)}`).join(' ') +
    (close ? ' Z' : '');

  const across = (pct: number, colour: string, strokeWidth: number) => {
    const { l, r } = edgesAt(pct);
    const a = at(pct, l + 2);
    const b = at(pct, r - 2);
    return `<line x1="${sx(a)}" y1="${sy(a)}" x2="${sx(b)}" y2="${sy(b)}" stroke="${colour}" stroke-width="${strokeWidth.toFixed(1)}"/>`;
  };

  const placed: Box[] = [];
  const labels: string[] = [];
  for (const [index, turn] of (input.turns ?? []).entries()) {
    const pct =
      turn.marker ??
      (turn.start !== undefined && turn.end !== undefined
        ? turn.start + wrap01(turn.end - turn.start) / 2
        : undefined);
    if (pct === undefined || !Number.isFinite(pct)) continue;
    const number = turn.number ?? index + 1;
    const text =
      turn.name && !new RegExp(`^(?:t|turn\\s*)${number}$`, 'i').test(turn.name)
        ? `T${number} ${turn.name}`
        : `T${number}`;
    const before = at(pct - TURN_PROBE, 0);
    const here = at(pct, 0);
    const after = at(pct + TURN_PROBE, 0);
    const bend =
      (here.x - before.x) * (after.y - here.y) -
      (here.y - before.y) * (after.x - here.x);
    const { l, r } = edgesAt(pct);
    const boxWidth = text.length * fontSize * 0.55;
    const sides = bend < 0 ? [1, -1] : [-1, 1];
    let chosen: { point: Point; box: Box } | null = null;
    for (const side of sides) {
      for (const distance of LABEL_DISTANCES_IN_FONT_SIZES) {
        const offset =
          side > 0 ? l + distance * fontSize : r - distance * fontSize;
        const point = at(pct, offset);
        const box = {
          x: point.x,
          y: point.y,
          w: boxWidth,
          h: fontSize * 1.2,
        };
        if (!placed.some((other) => overlaps(box, other))) {
          chosen = { point, box };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) {
      const point = at(
        pct,
        sides[0] > 0 ? l + fontSize * 1.6 : r - fontSize * 1.6
      );
      chosen = {
        point,
        box: { x: point.x, y: point.y, w: boxWidth, h: fontSize * 1.2 },
      };
    }
    placed.push(chosen.box);
    labels.push(
      `<text x="${sx(chosen.point)}" y="${sy(chosen.point)}" class="label" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>`
    );
  }

  const road = hasWidth
    ? `<path d="${path(leftEdge, true)} ${path([...rightEdge].reverse(), true)}" fill="#334155" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="${stroke.toFixed(1)}"/>`
    : `<path d="${path(world.track.racing, true)}" fill="none" stroke="#e2e8f0" stroke-width="${FALLBACK_ROAD_WIDTH_M}" stroke-linejoin="round"/>\n<path d="${path(world.track.racing, true)}" fill="none" stroke="#334155" stroke-width="${(FALLBACK_ROAD_WIDTH_M - stroke * 2).toFixed(1)}" stroke-linejoin="round"/>`;
  const sectors = input.sectors ?? null;
  const arrowFrom = at(START_ARROW[0], 0);
  const arrowTo = at(START_ARROW[1], 0);
  const medianWidthM = medianOf(widths);
  const legend = `${trackName} - ${lapDistM.toFixed(0)} m - ${
    hasWidth
      ? `road from learned edges (median ${medianWidthM?.toFixed(1)} m)`
      : `no learned width yet, road drawn ${FALLBACK_ROAD_WIDTH_M} m wide`
  } - dashed: LMU racing line, grey: pit lane, white: start/finish${
    sectors ? ', yellow: sectors' : ''
  }`;
  const legendSize = Math.min(
    fontSize * 0.9,
    (width - fontSize * 2) / (legend.length * 0.55)
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}">
<title>${escapeXml(trackName)}</title>
<style>
  .label { font: 600 ${fontSize.toFixed(1)}px Lato, 'Segoe UI', sans-serif; fill: #e2e8f0; paint-order: stroke; stroke: #0f172a; stroke-width: ${(fontSize / 4).toFixed(1)}px; }
  .legend { font: 400 ${legendSize.toFixed(1)}px Lato, 'Segoe UI', sans-serif; fill: #94a3b8; }
</style>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fbbf24"/></marker></defs>
<rect width="100%" height="100%" fill="#0f172a"/>
${world.track.pitLane.length >= 2 ? `<path d="${path(world.track.pitLane, false)}" fill="none" stroke="#475569" stroke-width="${(stroke * 4).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
${road}
<path d="${path(world.track.racing, true)}" fill="none" stroke="#64748b" stroke-width="${stroke.toFixed(1)}" stroke-dasharray="${(stroke * 4).toFixed(1)} ${(stroke * 4).toFixed(1)}"/>
${across(0, '#ffffff', stroke * 3)}
${sectors ? sectors.map((pct) => across(pct, '#fbbf24', stroke * 2)).join('\n') : ''}
<line x1="${sx(arrowFrom)}" y1="${sy(arrowFrom)}" x2="${sx(arrowTo)}" y2="${sy(arrowTo)}" stroke="#fbbf24" stroke-width="${(stroke * 2).toFixed(1)}" marker-end="url(#arrow)"/>
${labels.join('\n')}
<text x="${fontSize.toFixed(1)}" y="${(height - fontSize).toFixed(1)}" class="legend">${escapeXml(legend)}</text>
</svg>
`;
  return {
    svg,
    hasWidth,
    medianWidthM,
    unknownBins,
    labels: labels.length,
    sizeM: [Math.round(maxX - minX), Math.round(maxY - minY)],
  };
}
