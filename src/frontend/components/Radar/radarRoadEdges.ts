import type { ScreenPose } from './radarProjection';

const HEADER = 3;

export const ROAD_EDGE_BLEND_M = 10;

export type RoadSide = 'left' | 'right';

export const validRoadEdges = (
  edges: readonly number[] | null | undefined
): edges is readonly number[] => {
  if (!edges || edges.length < HEADER) return false;
  const [start, step, count] = edges;
  return (
    Number.isFinite(start) &&
    step > 0 &&
    Number.isInteger(count) &&
    count >= 2 &&
    edges.length === HEADER + count * 2
  );
};

export const roadEdgeAt = (
  edges: readonly number[],
  pct: number,
  side: RoadSide
): number => {
  const start = edges[0];
  const step = edges[1];
  const count = edges[2];
  let delta = (pct - start) % 1;
  if (delta < 0) delta += 1;
  const position = delta / step;
  if (!(position <= count - 1)) return Number.NaN;
  const index = Math.floor(position);
  const next = Math.min(index + 1, count - 1);
  const amount = position - index;
  const base = HEADER + (side === 'left' ? 0 : count);
  const a = edges[base + index];
  const b = edges[base + next];
  const aKnown = Number.isFinite(a);
  const bKnown = Number.isFinite(b);
  if (aKnown && bKnown) return a + (b - a) * amount;
  if (aKnown) return a;
  if (bKnown) return b;
  return Number.NaN;
};

export interface RoadEdgeTrace {
  count: number;
  leftX: Float64Array;
  leftY: Float64Array;
  rightX: Float64Array;
  rightY: Float64Array;
  learnedLeft: Float64Array;
  learnedRight: Float64Array;
  knownBehind: Float64Array;
}

export interface RoadEdgeProjector {
  project: (dist: number, lateral: number, output: ScreenPose) => ScreenPose;
}

export const createRoadEdgeTrace = (): RoadEdgeTrace => ({
  count: 0,
  leftX: new Float64Array(0),
  leftY: new Float64Array(0),
  rightX: new Float64Array(0),
  rightY: new Float64Array(0),
  learnedLeft: new Float64Array(0),
  learnedRight: new Float64Array(0),
  knownBehind: new Float64Array(0),
});

export const traceRoadEdges = (
  trace: RoadEdgeTrace,
  projector: RoadEdgeProjector,
  pose: ScreenPose,
  edges: readonly number[],
  playerPct: number,
  trackLength: number,
  reach: number,
  step: number,
  fallbackLeft: number,
  fallbackRight: number
): RoadEdgeTrace => {
  const count = Math.floor((reach * 2) / step) + 1;
  if (trace.leftX.length < count) {
    trace.leftX = new Float64Array(count);
    trace.leftY = new Float64Array(count);
    trace.rightX = new Float64Array(count);
    trace.rightY = new Float64Array(count);
    trace.learnedLeft = new Float64Array(count);
    trace.learnedRight = new Float64Array(count);
    trace.knownBehind = new Float64Array(count);
  }
  trace.count = count;
  const { learnedLeft, learnedRight, knownBehind } = trace;
  let lastUnknown = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < count; index += 1) {
    const pct = playerPct + (-reach + index * step) / trackLength;
    const left = roadEdgeAt(edges, pct, 'left');
    const right = roadEdgeAt(edges, pct, 'right');
    const known = Number.isFinite(left) && Number.isFinite(right);
    learnedLeft[index] = known ? left : Number.NaN;
    learnedRight[index] = known ? right : Number.NaN;
    if (!known) lastUnknown = index;
    knownBehind[index] = (index - lastUnknown) * step;
  }
  let nextUnknown = Number.POSITIVE_INFINITY;
  for (let index = count - 1; index >= 0; index -= 1) {
    const dist = -reach + index * step;
    let left = fallbackLeft;
    let right = fallbackRight;
    if (Number.isFinite(learnedLeft[index])) {
      const distance = Math.min(
        knownBehind[index],
        (nextUnknown - index) * step
      );
      const weight = Math.min(1, distance / ROAD_EDGE_BLEND_M);
      left = fallbackLeft + (learnedLeft[index] - fallbackLeft) * weight;
      right = fallbackRight + (learnedRight[index] - fallbackRight) * weight;
    } else {
      nextUnknown = index;
    }
    projector.project(dist, left, pose);
    trace.leftX[index] = pose.x;
    trace.leftY[index] = pose.y;
    projector.project(dist, right, pose);
    trace.rightX[index] = pose.x;
    trace.rightY[index] = pose.y;
  }
  return trace;
};
