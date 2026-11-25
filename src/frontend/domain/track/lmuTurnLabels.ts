import { lmuTrackDataId } from '@irdashies/types';
import {
  loadLmuTrackData,
  loadTrackData,
  type LovelyTurn,
} from '@irdashies/utils/trackData';
import type { TrackDrawing } from './trackDrawing';

const MAP_WIDTH = 1920;
const MAP_HEIGHT = 1080;
const TRACK_GAP = 6;
const LINE_HEIGHT = 34;
const LABEL_HEIGHT = 46;
const CHAR_WIDTH = 17.6;
const LABEL_PADDING = 20;
const EXTRA_DISTANCES = [0, 30, 60, 100];
const SWEEP_ANGLES = [
  0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180,
].map((degrees) => (degrees * Math.PI) / 180);
const BEND_PROBE = 0.004;
const TRACK_HIT_COST = 400;
const GENERIC_NAME = /^(?:t|turn\s*)(\d+)$/i;

interface Point {
  x: number;
  y: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type TurnLabel = NonNullable<TrackDrawing['turns']>[number];

export interface LmuTurnLabelLayout {
  fontScale: number;
  trackWidth: number;
}

const DEFAULT_LAYOUT: LmuTurnLabelLayout = { fontScale: 1, trackWidth: 40 };

const wrap01 = (value: number) => ((value % 1) + 1) % 1;
const round2 = (value: number) => Math.round(value * 100) / 100;

export const lmuCorners = (
  trackName: string | undefined
): readonly LovelyTurn[] => {
  if (!trackName) return [];
  const own = loadLmuTrackData(trackName)?.turn;
  if (own?.length) return own;
  const alias = lmuTrackDataId(trackName);
  return (alias ? loadTrackData(alias)?.turn : undefined) ?? [];
};

const pointAt = (points: readonly Point[], pct: number): Point => {
  const floatIndex = wrap01(pct) * (points.length - 1);
  const index = Math.floor(floatIndex);
  const next = Math.min(index + 1, points.length - 1);
  const amount = floatIndex - index;
  return {
    x: points[index].x + (points[next].x - points[index].x) * amount,
    y: points[index].y + (points[next].y - points[index].y) * amount,
  };
};

const outwardAt = (points: readonly Point[], pct: number) => {
  const here = pointAt(points, pct);
  const before = pointAt(points, pct - BEND_PROBE);
  const after = pointAt(points, pct + BEND_PROBE);
  const inwardX = (before.x + after.x) / 2 - here.x;
  const inwardY = (before.y + after.y) / 2 - here.y;
  const inward = Math.hypot(inwardX, inwardY);
  if (inward > 1e-6) {
    return { here, x: -inwardX / inward, y: -inwardY / inward };
  }
  const tangentX = after.x - before.x;
  const tangentY = after.y - before.y;
  const tangent = Math.hypot(tangentX, tangentY) || 1;
  return { here, x: tangentY / tangent, y: -tangentX / tangent };
};

const cornerPct = (turn: LovelyTurn): number | null => {
  const pct =
    turn.marker ??
    (turn.start !== undefined && turn.end !== undefined
      ? turn.start + wrap01(turn.end - turn.start) / 2
      : undefined);
  return pct !== undefined && Number.isFinite(pct) ? wrap01(pct) : null;
};

const cornerText = (turn: LovelyTurn, index: number) => {
  const name = turn.name?.trim() ?? '';
  const generic = GENERIC_NAME.exec(name)?.[1];
  const number = String(turn.number ?? generic ?? index + 1);
  const repeatsNumber =
    !name || new RegExp(`^(?:t|turn\\s*)${number}$`, 'i').test(name);
  return { number, name: repeatsNumber || generic ? null : name };
};

const textWidth = (text: string, scale: number) =>
  (text.length * CHAR_WIDTH + LABEL_PADDING) * scale;

const boxAt = (centre: Point, halfWidth: number, halfHeight: number): Box => ({
  left: centre.x - halfWidth,
  right: centre.x + halfWidth,
  top: centre.y - halfHeight,
  bottom: centre.y + halfHeight,
});

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const crowding = (
  box: Box,
  placed: readonly Box[],
  points: readonly Point[],
  clearance: number
): number => {
  if (
    box.left < 0 ||
    box.top < 0 ||
    box.right > MAP_WIDTH ||
    box.bottom > MAP_HEIGHT
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const labelOverlap = placed.reduce(
    (sum, other) => sum + overlapArea(box, other),
    0
  );
  const trackHits = points.filter(
    (point) =>
      point.x > box.left - clearance &&
      point.x < box.right + clearance &&
      point.y > box.top - clearance &&
      point.y < box.bottom + clearance
  ).length;
  return labelOverlap + trackHits * TRACK_HIT_COST;
};

const clampToMap = (centre: Point, halfWidth: number, halfHeight: number) => ({
  x: Math.min(Math.max(centre.x, halfWidth), MAP_WIDTH - halfWidth),
  y: Math.min(Math.max(centre.y, halfHeight), MAP_HEIGHT - halfHeight),
});

export const lmuTurnLabels = (
  drawing: TrackDrawing,
  corners: readonly LovelyTurn[],
  layout: LmuTurnLabelLayout = DEFAULT_LAYOUT
): TurnLabel[] => {
  const points = drawing.active.trackPathPoints;
  if (!points || points.length < 2) return [];
  const scale = Number.isFinite(layout.fontScale)
    ? Math.max(0.1, layout.fontScale)
    : DEFAULT_LAYOUT.fontScale;
  const trackWidth = Number.isFinite(layout.trackWidth)
    ? Math.max(0, layout.trackWidth)
    : DEFAULT_LAYOUT.trackWidth;
  const clearance = trackWidth / 2 + TRACK_GAP;
  const lineHeight = LINE_HEIGHT * scale;
  const labelHeight = LABEL_HEIGHT * scale;
  const placed: Box[] = [];
  return corners.flatMap((turn, index) => {
    const pct = cornerPct(turn);
    if (pct === null) return [];
    const { number, name } = cornerText(turn, index);
    const halfWidth =
      Math.max(textWidth(number, scale), name ? textWidth(name, scale) : 0) / 2;
    const halfHeight = (name ? lineHeight + labelHeight : labelHeight) / 2;
    const { here, x, y } = outwardAt(points, pct);

    let chosen: { centre: Point; up: boolean } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const step of EXTRA_DISTANCES) {
      const extra = step * scale;
      for (const angle of SWEEP_ANGLES) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const ux = x * cos - y * sin;
        const uy = x * sin + y * cos;
        const reach =
          clearance +
          halfWidth * Math.abs(ux) +
          halfHeight * Math.abs(uy) +
          extra;
        const centre = { x: here.x + ux * reach, y: here.y + uy * reach };
        const score = crowding(
          boxAt(centre, halfWidth, halfHeight),
          placed,
          points,
          clearance
        );
        if (score < bestScore) {
          bestScore = score;
          chosen = { centre, up: uy < 0 };
        }
        if (score === 0) break;
      }
      if (bestScore === 0) break;
    }
    if (!chosen) {
      const reach =
        clearance + halfWidth * Math.abs(x) + halfHeight * Math.abs(y);
      chosen = {
        centre: clampToMap(
          { x: here.x + x * reach, y: here.y + y * reach },
          halfWidth,
          halfHeight
        ),
        up: y < 0,
      };
    }
    placed.push(boxAt(chosen.centre, halfWidth, halfHeight));

    const { centre, up } = chosen;
    if (!name) {
      return [{ x: round2(centre.x), y: round2(centre.y), content: number }];
    }
    const nearTrack = up ? lineHeight / 2 : -lineHeight / 2;
    return [
      {
        x: round2(centre.x),
        y: round2(centre.y + nearTrack),
        content: number,
      },
      { x: round2(centre.x), y: round2(centre.y - nearTrack), content: name },
    ];
  });
};
