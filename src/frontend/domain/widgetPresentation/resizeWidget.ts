import type { WidgetLayout } from '@irdashies/types';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Shared by overlay editing, the website, and settings demo frames. */
export function resizeWidgetLayout(
  start: WidgetLayout,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  minWidth = 100,
  minHeight = 50
): WidgetLayout {
  const next = { ...start };
  if (direction.includes('e'))
    next.width = Math.max(minWidth, start.width + deltaX);
  if (direction.includes('w')) {
    next.width = Math.max(minWidth, start.width - deltaX);
    next.x = start.x + start.width - next.width;
  }
  if (direction.includes('s'))
    next.height = Math.max(minHeight, start.height + deltaY);
  if (direction.includes('n')) {
    next.height = Math.max(minHeight, start.height - deltaY);
    next.y = start.y + start.height - next.height;
  }
  return next;
}
