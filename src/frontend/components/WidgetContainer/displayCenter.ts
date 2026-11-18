import type { WidgetLayout } from '@irdashies/types';
import type { SnapBounds } from './snapToViewportGrid';

/**
 * How close a widget's left or right edge must come to the display's middle
 * for the center line to appear, in pixels.
 */
export const CENTER_GUIDE_SHOW_PX = 20;

/**
 * How close a widget's own center must come to the display's middle for the
 * widget to snap onto it, in pixels.
 */
export const CENTER_SNAP_PX = 8;

/** The display's horizontal middle, in screen coordinates. */
export const displayCenterX = (bounds: SnapBounds): number =>
  bounds.x + bounds.width / 2;

/**
 * Whether a dragged widget is near the display's middle: it covers the middle,
 * or its left or right edge has come within CENTER_GUIDE_SHOW_PX of it.
 */
export const isNearDisplayCenter = (
  layout: WidgetLayout,
  centerX: number
): boolean =>
  layout.x - CENTER_GUIDE_SHOW_PX <= centerX &&
  centerX <= layout.x + layout.width + CENTER_GUIDE_SHOW_PX;

/**
 * Centers `layout` on the display's middle when the pointer-driven layout's
 * own center is within CENTER_SNAP_PX of it; otherwise returns `layout` as
 * it is. Judged on the raw layout, so a grid snap applied before cannot move
 * the widget into or out of reach.
 */
export const snapToDisplayCenter = (
  layout: WidgetLayout,
  rawLayout: WidgetLayout,
  centerX: number
): WidgetLayout => {
  const rawCenter = rawLayout.x + rawLayout.width / 2;
  if (Math.abs(rawCenter - centerX) > CENTER_SNAP_PX) return layout;
  return { ...layout, x: Math.round(centerX - layout.width / 2) };
};
