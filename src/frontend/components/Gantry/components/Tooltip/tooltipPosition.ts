export const VIEWPORT_MARGIN = 8;

export interface Bounds {
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  left: number;
  top: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Keeps a floating box inside its bounds. Bounds are the viewport for a
 * portalled tooltip, or a container box for a readout drawn inside a panel.
 */
export const clampToBounds = (
  desired: Point,
  size: Size,
  bounds: Bounds,
  margin = VIEWPORT_MARGIN
): Point => ({
  left: clamp(desired.left, margin, bounds.width - size.width - margin),
  top: clamp(desired.top, margin, bounds.height - size.height - margin),
});

/**
 * Picks a top for a box anchored above or below a target, flipping to the
 * other side when the preferred side has no room.
 */
export const placeVertically = (
  anchor: { top: number; bottom: number },
  height: number,
  placement: 'top' | 'bottom',
  boundsHeight: number,
  margin = VIEWPORT_MARGIN
): number => {
  const above = anchor.top - height - margin;
  const below = anchor.bottom + margin;
  let top = placement === 'bottom' ? below : above;
  if (top < margin) top = below;
  if (top + height > boundsHeight - margin) top = above;
  return top;
};

export interface EdgeAnchor {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/**
 * Anchors a floating box to whichever edges keep it inside `bounds`, without
 * needing to know how big the box is. Used for the chart readout, where
 * measuring would cost a second render on every pointer move.
 */
export const anchorInsideBounds = (
  point: { x: number; y: number },
  bounds: Bounds,
  offset: number
): EdgeAnchor => {
  const anchor: EdgeAnchor = {};
  if (point.x > bounds.width / 2)
    anchor.right = bounds.width - point.x + offset;
  else anchor.left = point.x + offset;
  if (point.y > bounds.height / 2)
    anchor.bottom = bounds.height - point.y + offset;
  else anchor.top = point.y + offset;
  return anchor;
};
