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
const FALLBACK_DISTANCES = [140, 180];
const SWEEP_ANGLES = [
  0,
  ...Array.from({ length: 11 }, (_, index) => (index + 1) * 15).flatMap(
    (degrees) => [degrees, -degrees]
  ),
  180,
].map((degrees) => (degrees * Math.PI) / 180);
const BEND_PROBE = 0.004;
const TRACK_HIT_COST = 400;
const REFINE_PASSES = 2;
const MISPLACED_LABELS = 2;
const GRID_CELL = 64;
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

const distanceToBox = (point: Point, box: Box) =>
  Math.hypot(
    Math.max(box.left - point.x, 0, point.x - box.right),
    Math.max(box.top - point.y, 0, point.y - box.bottom)
  );

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const pointGrid = (points: readonly Point[]) => {
  const cells = new Map<string, Point[]>();
  for (const point of points) {
    const key = `${Math.floor(point.x / GRID_CELL)},${Math.floor(point.y / GRID_CELL)}`;
    const cell = cells.get(key);
    if (cell) cell.push(point);
    else cells.set(key, [point]);
  }
  return (box: Box, clearance: number) => {
    const left = box.left - clearance;
    const right = box.right + clearance;
    const top = box.top - clearance;
    const bottom = box.bottom + clearance;
    let hits = 0;
    for (
      let column = Math.floor(left / GRID_CELL);
      column <= Math.floor(right / GRID_CELL);
      column += 1
    ) {
      for (
        let row = Math.floor(top / GRID_CELL);
        row <= Math.floor(bottom / GRID_CELL);
        row += 1
      ) {
        for (const point of cells.get(`${column},${row}`) ?? []) {
          if (
            point.x > left &&
            point.x < right &&
            point.y > top &&
            point.y < bottom
          ) {
            hits += 1;
          }
        }
      }
    }
    return hits;
  };
};

const clampToMap = (centre: Point, halfWidth: number, halfHeight: number) => ({
  x:
    halfWidth * 2 >= MAP_WIDTH
      ? MAP_WIDTH / 2
      : Math.min(Math.max(centre.x, halfWidth), MAP_WIDTH - halfWidth),
  y:
    halfHeight * 2 >= MAP_HEIGHT
      ? MAP_HEIGHT / 2
      : Math.min(Math.max(centre.y, halfHeight), MAP_HEIGHT - halfHeight),
});

interface CornerPlan {
  number: string;
  name: string | null;
  halfWidth: number;
  halfHeight: number;
  candidates: Point[];
  fallback: Point[];
  here: Point;
}

interface Placement {
  centre: Point;
  box: Box;
  score: number;
}

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
  const trackHits = pointGrid(points);

  const plans = corners.flatMap((turn, index): CornerPlan[] => {
    const pct = cornerPct(turn);
    if (pct === null) return [];
    const { number, name } = cornerText(turn, index);
    const halfWidth =
      Math.max(textWidth(number, scale), name ? textWidth(name, scale) : 0) / 2;
    const halfHeight = (name ? lineHeight + labelHeight : labelHeight) / 2;
    const { here, x, y } = outwardAt(points, pct);
    const ring = (distances: readonly number[]) =>
      distances.flatMap((step) =>
        SWEEP_ANGLES.map((angle) => {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const ux = x * cos - y * sin;
          const uy = x * sin + y * cos;
          const reach =
            clearance +
            halfWidth * Math.abs(ux) +
            halfHeight * Math.abs(uy) +
            step * scale;
          return clampToMap(
            { x: here.x + ux * reach, y: here.y + uy * reach },
            halfWidth,
            halfHeight
          );
        })
      );
    return [
      {
        number,
        name,
        halfWidth,
        halfHeight,
        candidates: ring(EXTRA_DISTANCES),
        fallback: ring(FALLBACK_DISTANCES),
        here,
      },
    ];
  });

  const misplacedCost = labelHeight * labelHeight * MISPLACED_LABELS;
  const score = (
    plan: CornerPlan,
    box: Box,
    others: readonly (Placement | null)[]
  ) => {
    const own = distanceToBox(plan.here, box) - labelHeight;
    const nearerCorners = plans.filter(
      (other) => other !== plan && distanceToBox(other.here, box) < own
    ).length;
    return (
      others.reduce(
        (sum, other) => sum + (other ? overlapArea(box, other.box) : 0),
        0
      ) +
      trackHits(box, clearance) * TRACK_HIT_COST +
      nearerCorners * misplacedCost
    );
  };

  const place = (
    candidates: readonly Point[],
    plan: CornerPlan,
    others: readonly (Placement | null)[]
  ): Placement => {
    let best: Placement | null = null;
    for (const centre of candidates) {
      const box = boxAt(centre, plan.halfWidth, plan.halfHeight);
      const value = score(plan, box, others);
      if (!best || value < best.score) best = { centre, box, score: value };
      if (value === 0) break;
    }
    return best as Placement;
  };

  const placements: (Placement | null)[] = plans.map(() => null);
  plans.forEach((plan, index) => {
    placements[index] = place(plan.candidates, plan, placements);
  });
  const refine = (candidatesOf: (plan: CornerPlan) => readonly Point[]) =>
    plans.forEach((plan, index) => {
      const current = placements[index];
      if (!current) return;
      const others = placements.map((other, at) =>
        at === index ? null : other
      );
      const currentScore = score(plan, current.box, others);
      if (currentScore === 0) return;
      const moved = place(candidatesOf(plan), plan, others);
      placements[index] =
        moved.score < currentScore
          ? moved
          : { ...current, score: currentScore };
    });
  for (let pass = 0; pass < REFINE_PASSES; pass += 1) {
    refine((plan) => plan.candidates);
  }
  refine((plan) => plan.fallback);

  return plans.flatMap((plan, index) => {
    const { centre } = placements[index] as Placement;
    const { number, name } = plan;
    if (!name) {
      return [{ x: round2(centre.x), y: round2(centre.y), content: number }];
    }
    const nearTrack = centre.y < plan.here.y ? lineHeight / 2 : -lineHeight / 2;
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
