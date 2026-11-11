import type { WidgetLayout } from '@irdashies/types';

/**
 * A layout in whole pixels. On a scaled display the pointer moves in
 * fractions of a CSS pixel (0.4 px at 250%), and a layout saved as it came
 * held sizes like 396.40000000000003 for every reader to round again.
 */
export const roundLayout = (layout: WidgetLayout): WidgetLayout => ({
  ...layout,
  x: Math.round(layout.x),
  y: Math.round(layout.y),
  width: Math.round(layout.width),
  height: Math.round(layout.height),
});
