import { useMemo } from 'react';
import type { WidgetLayout } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';

export interface EdgeDistances {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Computes pixel distances from each widget edge to the corresponding display edge.
 * Returns null when displayBounds isn't available (e.g., before the first IPC message arrives).
 */
export const useEdgeDistances = (
  layout: WidgetLayout,
  enabled = true
): EdgeDistances | null => {
  const { containerBoundsInfo } = useDashboard();

  return useMemo(() => {
    if (!enabled) return null;

    const displayBounds = containerBoundsInfo?.displayBounds;
    if (!displayBounds) return null;

    return {
      left: layout.x - displayBounds.x,
      top: layout.y - displayBounds.y,
      right: displayBounds.x + displayBounds.width - (layout.x + layout.width),
      bottom:
        displayBounds.y + displayBounds.height - (layout.y + layout.height),
    };
  }, [layout, containerBoundsInfo, enabled]);
};
