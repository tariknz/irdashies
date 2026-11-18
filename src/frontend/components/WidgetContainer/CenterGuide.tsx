import { memo } from 'react';
import type { SnapBounds } from './snapToViewportGrid';
import { displayCenterX } from './displayCenter';

export interface CenterGuideProps {
  /** The display the widget is on, in screen coordinates. */
  bounds: SnapBounds;
  /** Screen coordinates to the overlay window's own, as useContainerOffset. */
  offset: { x: number; y: number };
}

/**
 * A vertical line down the display's horizontal middle, shown in edit mode
 * while a widget is dragged near it. Fixed to the overlay window, under the
 * Exit Edit Mode button, which sits on the same middle.
 */
export const CenterGuide = memo(({ bounds, offset }: CenterGuideProps) => (
  <div
    aria-hidden="true"
    data-testid="center-guide"
    className="pointer-events-none fixed z-[9998] w-0.5 -translate-x-1/2 bg-sky-400"
    style={{
      left: displayCenterX(bounds) + offset.x,
      top: bounds.y + offset.y,
      height: bounds.height,
    }}
  />
));
CenterGuide.displayName = 'CenterGuide';
