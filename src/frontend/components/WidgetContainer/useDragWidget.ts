import { useState, useCallback, useRef, useEffect, PointerEvent } from 'react';
import type { WidgetLayout } from '@irdashies/types';

interface UseDragWidgetOptions {
  layout: WidgetLayout;
  onLayoutChange: (layout: WidgetLayout) => void;
  enabled: boolean;
}

interface DragState {
  startX: number;
  startY: number;
  startLayoutX: number;
  startLayoutY: number;
}

export function useDragWidget({
  layout,
  onLayoutChange,
  enabled,
}: UseDragWidgetOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const layoutRef = useRef(layout);

  // Keep layout ref updated
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startLayoutX: layoutRef.current.x,
        startLayoutY: layoutRef.current.y,
      };
      setIsDragging(true);
    },
    [enabled]
  );

  // Use window-level events for smooth dragging
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (!dragStateRef.current) return;

      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;

      onLayoutChange({
        ...layoutRef.current,
        x: dragStateRef.current.startLayoutX + deltaX,
        y: dragStateRef.current.startLayoutY + deltaY,
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onLayoutChange]);

  return {
    isDragging,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      style: { cursor: enabled ? 'move' : 'default' },
    },
  };
}
