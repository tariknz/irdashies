import type { WidgetLayout } from './dashboardLayout';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Does the layout's centre point fall inside these bounds? */
export const isLayoutOnDisplay = (layout: WidgetLayout, bounds: Rect) => {
  const centerX = layout.x + layout.width / 2;
  const centerY = layout.y + layout.height / 2;
  return (
    centerX >= bounds.x &&
    centerX < bounds.x + bounds.width &&
    centerY >= bounds.y &&
    centerY < bounds.y + bounds.height
  );
};

const wrap = (value: number, start: number, size: number) =>
  start + ((((value - start) % size) + size) % size);

/**
 * Bring a widget saved on a monitor that is no longer connected onto the given
 * display. The position is wrapped by the display size, so a layout built on a
 * same-sized monitor lands where it sat on that monitor, then clamped so the
 * widget fits. The saved layout is untouched, so reconnecting the monitor puts
 * the widget back.
 */
export const fitLayoutToDisplay = (
  layout: WidgetLayout,
  display: Rect
): WidgetLayout => {
  const width = Math.min(layout.width, display.width);
  const height = Math.min(layout.height, display.height);
  return {
    width,
    height,
    x: Math.min(
      wrap(layout.x, display.x, display.width),
      display.x + display.width - width
    ),
    y: Math.min(
      wrap(layout.y, display.y, display.height),
      display.y + display.height - height
    ),
  };
};
