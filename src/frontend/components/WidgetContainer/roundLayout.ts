import type { WidgetLayout } from '@irdashies/types';

/**
 * A layout in whole pixels. On a scaled display the pointer moves in
 * fractions of a CSS pixel (0.4 px at 250%), and a layout saved as it came
 * held sizes like 396.40000000000003 for every reader to round again.
 *
 * The edges are rounded, and the size taken between them: an edge already on
 * a whole pixel stays there. A resize from the left keeps the right edge
 * where it was, and a drag keeps the size.
 */
export const roundLayout = (layout: WidgetLayout): WidgetLayout => {
  const x = Math.round(layout.x);
  const y = Math.round(layout.y);
  return {
    ...layout,
    x,
    y,
    width: Math.round(layout.x + layout.width) - x,
    height: Math.round(layout.y + layout.height) - y,
  };
};
