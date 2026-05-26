import type { WidgetLayout } from '@irdashies/types';
import type { ResizeDirection } from './useResizeWidget';

export interface SnapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapEdge = 'left' | 'top' | 'right' | 'bottom';

export interface ViewportGridSnapOptions {
  bounds?: SnapBounds;
  siblingLayouts?: WidgetLayout[];
  disabled?: boolean;
}

interface SnapEdgeLock {
  target?: number;
  lockedAt?: number;
  freeUntil?: number;
  suppressed?: boolean;
}

export type ViewportGridSnapState = Partial<Record<SnapEdge, SnapEdgeLock>>;

export interface ViewportGridSnapResult {
  layout: WidgetLayout;
  state: ViewportGridSnapState;
}

const VIEWPORT_GRID_DIVISIONS = 200;
const EDGE_LOCK_MS = 400;
const EDGE_ESCAPE_PX = 6;
const EDGE_LOCK_THRESHOLD_PX = 4;
const EDGE_RELEASE_FREE_MS = 250;

const getGridSize = (length: number) =>
  Math.max(1, Math.round(length / VIEWPORT_GRID_DIVISIONS));

const snapToGrid = (value: number, origin: number, gridSize: number) =>
  origin + Math.round((value - origin) / gridSize) * gridSize;

const isNearEdge = (value: number, edge: number, threshold: number) =>
  Math.abs(value - edge) <= threshold;

const rangesOverlap = (
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
) => firstStart <= secondEnd && secondStart <= firstEnd;

const getHorizontalTargets = (
  bounds: SnapBounds,
  siblingLayouts: WidgetLayout[],
  layout: WidgetLayout
) => [
  bounds.x,
  bounds.x + bounds.width,
  ...siblingLayouts
    .filter((siblingLayout) =>
      rangesOverlap(
        layout.y,
        layout.y + layout.height,
        siblingLayout.y,
        siblingLayout.y + siblingLayout.height
      )
    )
    .flatMap((siblingLayout) => [
      siblingLayout.x,
      siblingLayout.x + siblingLayout.width,
    ]),
];

const getVerticalTargets = (
  bounds: SnapBounds,
  siblingLayouts: WidgetLayout[],
  layout: WidgetLayout
) => [
  bounds.y,
  bounds.y + bounds.height,
  ...siblingLayouts
    .filter((siblingLayout) =>
      rangesOverlap(
        layout.x,
        layout.x + layout.width,
        siblingLayout.x,
        siblingLayout.x + siblingLayout.width
      )
    )
    .flatMap((siblingLayout) => [
      siblingLayout.y,
      siblingLayout.y + siblingLayout.height,
    ]),
];

const findNearestTarget = (
  value: number,
  targets: number[],
  threshold: number
) => {
  return targets.reduce<number | undefined>((nearest, target) => {
    if (!isNearEdge(value, target, threshold)) return nearest;
    if (nearest === undefined) return target;

    return Math.abs(value - target) < Math.abs(value - nearest)
      ? target
      : nearest;
  }, undefined);
};

const shouldKeepEdgeLock = (
  edge: SnapEdge,
  layout: WidgetLayout,
  target: number,
  lockedAt: number,
  now: number
) => {
  if (now - lockedAt >= EDGE_LOCK_MS) return false;

  if (edge === 'left') return layout.x >= target - EDGE_ESCAPE_PX;
  if (edge === 'top') return layout.y >= target - EDGE_ESCAPE_PX;
  if (edge === 'right') {
    return layout.x + layout.width <= target + EDGE_ESCAPE_PX;
  }

  return layout.y + layout.height <= target + EDGE_ESCAPE_PX;
};

const applyEdgeLock = (
  layout: WidgetLayout,
  edge: SnapEdge,
  target: number,
  preserveOppositeEdge: boolean
) => {
  if (edge === 'left') {
    if (preserveOppositeEdge) {
      const rightEdge = layout.x + layout.width;
      return { ...layout, x: target, width: rightEdge - target };
    }

    return { ...layout, x: target };
  }

  if (edge === 'top') {
    if (preserveOppositeEdge) {
      const bottomEdge = layout.y + layout.height;
      return { ...layout, y: target, height: bottomEdge - target };
    }

    return { ...layout, y: target };
  }

  if (edge === 'right') {
    if (preserveOppositeEdge) {
      return { ...layout, width: target - layout.x };
    }

    return { ...layout, x: target - layout.width };
  }

  if (preserveOppositeEdge) {
    return { ...layout, height: target - layout.y };
  }

  return { ...layout, y: target - layout.height };
};

const applyRawEdge = (
  layout: WidgetLayout,
  edge: SnapEdge,
  rawLayout: WidgetLayout,
  preserveOppositeEdge: boolean
) => {
  if (edge === 'left') {
    if (preserveOppositeEdge) {
      return { ...layout, x: rawLayout.x, width: rawLayout.width };
    }

    return { ...layout, x: rawLayout.x };
  }

  if (edge === 'top') {
    if (preserveOppositeEdge) {
      return { ...layout, y: rawLayout.y, height: rawLayout.height };
    }

    return { ...layout, y: rawLayout.y };
  }

  if (edge === 'right') {
    if (preserveOppositeEdge) {
      return { ...layout, width: rawLayout.width };
    }

    return { ...layout, x: rawLayout.x };
  }

  if (preserveOppositeEdge) {
    return { ...layout, height: rawLayout.height };
  }

  return { ...layout, y: rawLayout.y };
};

const omitEdgeState = (
  state: ViewportGridSnapState,
  edge: SnapEdge
): ViewportGridSnapState => {
  return Object.fromEntries(
    Object.entries(state).filter(([stateEdge]) => stateEdge !== edge)
  ) as ViewportGridSnapState;
};

const lockEdgeIfNear = (
  layout: WidgetLayout,
  edge: SnapEdge,
  rawLayout: WidgetLayout,
  targets: number[],
  threshold: number,
  state: ViewportGridSnapState,
  now: number,
  preserveOppositeEdge: boolean
) => {
  let nextState = { ...state };
  const edgeState = nextState[edge];
  const lockedAt = edgeState?.lockedAt;
  const freeUntil = edgeState?.freeUntil;

  const edgeValue =
    edge === 'left'
      ? rawLayout.x
      : edge === 'top'
        ? rawLayout.y
        : edge === 'right'
          ? rawLayout.x + rawLayout.width
          : rawLayout.y + rawLayout.height;
  const nearestTarget = findNearestTarget(edgeValue, targets, threshold);
  const nearLockedTarget =
    edgeState?.target !== undefined &&
    isNearEdge(edgeValue, edgeState.target, EDGE_LOCK_THRESHOLD_PX);

  const lockedTarget = edgeState?.target;
  if (freeUntil !== undefined && now < freeUntil) {
    return {
      layout: applyRawEdge(layout, edge, rawLayout, preserveOppositeEdge),
      state: nextState,
    };
  }

  if (
    lockedAt !== undefined &&
    lockedTarget !== undefined &&
    shouldKeepEdgeLock(edge, rawLayout, lockedTarget, lockedAt, now)
  ) {
    return {
      layout: applyEdgeLock(layout, edge, lockedTarget, preserveOppositeEdge),
      state: nextState,
    };
  }

  if (edgeState?.suppressed && nearLockedTarget) {
    return { layout, state: nextState };
  }

  nextState = omitEdgeState(nextState, edge);

  if (lockedAt !== undefined || edgeState?.suppressed) {
    if (lockedAt !== undefined && !nearLockedTarget) {
      nextState[edge] = {
        target: edgeState?.target,
        freeUntil: now + EDGE_RELEASE_FREE_MS,
      };
      return {
        layout: applyRawEdge(layout, edge, rawLayout, preserveOppositeEdge),
        state: nextState,
      };
    }

    if (nearLockedTarget) {
      nextState[edge] = {
        target: edgeState?.target,
        suppressed: true,
      };
      return { layout, state: nextState };
    }

    return { layout, state: nextState };
  }

  if (nearestTarget === undefined) {
    return { layout, state: nextState };
  }

  nextState[edge] = { target: nearestTarget, lockedAt: now };
  return {
    layout: applyEdgeLock(layout, edge, nearestTarget, preserveOppositeEdge),
    state: nextState,
  };
};

export const snapLayoutPositionToViewportGrid = (
  layout: WidgetLayout,
  options: ViewportGridSnapOptions = {},
  state: ViewportGridSnapState = {},
  now = Date.now()
): ViewportGridSnapResult => {
  const { bounds, disabled = false, siblingLayouts = [] } = options;
  if (!bounds || disabled) return { layout, state: {} };

  const gridX = getGridSize(bounds.width);
  const gridY = getGridSize(bounds.height);
  const horizontalTargets = getHorizontalTargets(
    bounds,
    siblingLayouts,
    layout
  );
  const verticalTargets = getVerticalTargets(bounds, siblingLayouts, layout);
  let result = {
    ...layout,
    x: snapToGrid(layout.x, bounds.x, gridX),
    y: snapToGrid(layout.y, bounds.y, gridY),
  };
  let nextState = state;

  const horizontalEdges: SnapEdge[] = ['left', 'right'];
  const verticalEdges: SnapEdge[] = ['top', 'bottom'];

  horizontalEdges.forEach((edge) => {
    const next = lockEdgeIfNear(
      result,
      edge,
      layout,
      horizontalTargets,
      EDGE_LOCK_THRESHOLD_PX,
      nextState,
      now,
      false
    );
    result = next.layout;
    nextState = next.state;
  });

  verticalEdges.forEach((edge) => {
    const next = lockEdgeIfNear(
      result,
      edge,
      layout,
      verticalTargets,
      EDGE_LOCK_THRESHOLD_PX,
      nextState,
      now,
      false
    );
    result = next.layout;
    nextState = next.state;
  });

  return { layout: result, state: nextState };
};

const enforceResizeMinimums = (
  layout: WidgetLayout,
  direction: ResizeDirection,
  minWidth: number,
  minHeight: number
) => {
  const nextLayout = { ...layout };

  if (direction.includes('w') && nextLayout.width < minWidth) {
    const rightEdge = nextLayout.x + nextLayout.width;
    nextLayout.x = rightEdge - minWidth;
    nextLayout.width = minWidth;
  } else if (direction.includes('e')) {
    nextLayout.width = Math.max(minWidth, nextLayout.width);
  }

  if (direction.includes('n') && nextLayout.height < minHeight) {
    const bottomEdge = nextLayout.y + nextLayout.height;
    nextLayout.y = bottomEdge - minHeight;
    nextLayout.height = minHeight;
  } else if (direction.includes('s')) {
    nextLayout.height = Math.max(minHeight, nextLayout.height);
  }

  return nextLayout;
};

export const snapLayoutResizeToViewportGrid = (
  layout: WidgetLayout,
  direction: ResizeDirection,
  options: ViewportGridSnapOptions,
  minWidth: number,
  minHeight: number,
  state: ViewportGridSnapState = {},
  now = Date.now()
): ViewportGridSnapResult => {
  const { bounds, disabled = false, siblingLayouts = [] } = options;
  if (!bounds || disabled) return { layout, state: {} };

  const snappedLayout = { ...layout };
  const gridX = getGridSize(bounds.width);
  const gridY = getGridSize(bounds.height);
  const horizontalTargets = getHorizontalTargets(
    bounds,
    siblingLayouts,
    layout
  );
  const verticalTargets = getVerticalTargets(bounds, siblingLayouts, layout);

  if (direction.includes('e')) {
    const rightEdge = snapToGrid(layout.x + layout.width, bounds.x, gridX);
    snappedLayout.width = Math.max(minWidth, rightEdge - layout.x);
  }

  if (direction.includes('w')) {
    const rightEdge = layout.x + layout.width;
    const leftEdge = snapToGrid(layout.x, bounds.x, gridX);
    const nextWidth = rightEdge - leftEdge;
    snappedLayout.x = nextWidth < minWidth ? rightEdge - minWidth : leftEdge;
    snappedLayout.width = Math.max(minWidth, nextWidth);
  }

  if (direction.includes('s')) {
    const bottomEdge = snapToGrid(layout.y + layout.height, bounds.y, gridY);
    snappedLayout.height = Math.max(minHeight, bottomEdge - layout.y);
  }

  if (direction.includes('n')) {
    const bottomEdge = layout.y + layout.height;
    const topEdge = snapToGrid(layout.y, bounds.y, gridY);
    const nextHeight = bottomEdge - topEdge;
    snappedLayout.y = nextHeight < minHeight ? bottomEdge - minHeight : topEdge;
    snappedLayout.height = Math.max(minHeight, nextHeight);
  }

  let result = snappedLayout;
  let nextState = state;

  const activeEdges: SnapEdge[] = [
    ...(direction.includes('w') ? (['left'] as const) : []),
    ...(direction.includes('e') ? (['right'] as const) : []),
    ...(direction.includes('n') ? (['top'] as const) : []),
    ...(direction.includes('s') ? (['bottom'] as const) : []),
  ];

  activeEdges.forEach((edge) => {
    const next = lockEdgeIfNear(
      result,
      edge,
      layout,
      edge === 'left' || edge === 'right' ? horizontalTargets : verticalTargets,
      EDGE_LOCK_THRESHOLD_PX,
      nextState,
      now,
      true
    );
    result = next.layout;
    nextState = next.state;
  });

  return {
    layout: enforceResizeMinimums(result, direction, minWidth, minHeight),
    state: nextState,
  };
};
