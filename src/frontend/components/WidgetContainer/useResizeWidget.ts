import { useState, useCallback, useRef, useEffect, PointerEvent } from 'react';
import type { WidgetLayout } from '@irdashies/types';

export type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

interface UseResizeWidgetOptions {
  layout: WidgetLayout;
  onLayoutChange: (layout: WidgetLayout) => void;
  enabled: boolean;
  minWidth?: number;
  minHeight?: number;
}

interface ResizeState {
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startLayout: WidgetLayout;
}

const MIN_WIDTH = 100;
const MIN_HEIGHT = 50;

export function useResizeWidget({
  layout,
  onLayoutChange,
  enabled,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
}: UseResizeWidgetOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [activeDirection, setActiveDirection] =
    useState<ResizeDirection | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const layoutRef = useRef(layout);

  // Keep layout ref updated
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const handlePointerDown = useCallback(
    (direction: ResizeDirection) => (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      resizeStateRef.current = {
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startLayout: { ...layoutRef.current },
      };
      setIsResizing(true);
      setActiveDirection(direction);
    },
    [enabled]
  );

  // Use window-level events for smooth resizing
  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (!resizeStateRef.current) return;

      const { direction, startX, startY, startLayout } = resizeStateRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newLayout = { ...startLayout };

      // Handle horizontal resize
      if (direction.includes('e')) {
        newLayout.width = Math.max(minWidth, startLayout.width + deltaX);
      }
      if (direction.includes('w')) {
        const newWidth = Math.max(minWidth, startLayout.width - deltaX);
        const widthDiff = startLayout.width - newWidth;
        newLayout.x = startLayout.x + widthDiff;
        newLayout.width = newWidth;
      }

      // Handle vertical resize
      if (direction.includes('s')) {
        newLayout.height = Math.max(minHeight, startLayout.height + deltaY);
      }
      if (direction.includes('n')) {
        const newHeight = Math.max(minHeight, startLayout.height - deltaY);
        const heightDiff = startLayout.height - newHeight;
        newLayout.y = startLayout.y + heightDiff;
        newLayout.height = newHeight;
      }

      onLayoutChange(newLayout);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
      setActiveDirection(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, minWidth, minHeight, onLayoutChange]);

  const getResizeHandleProps = useCallback(
    (direction: ResizeDirection) => ({
      onPointerDown: handlePointerDown(direction),
      style: { cursor: enabled ? getCursor(direction) : 'default' },
    }),
    [handlePointerDown, enabled]
  );

  return {
    isResizing,
    activeDirection,
    getResizeHandleProps,
  };
}

function getCursor(direction: ResizeDirection): string {
  const cursors: Record<ResizeDirection, string> = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
  };
  return cursors[direction];
}
