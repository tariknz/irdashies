import { useState, useCallback, useRef, useEffect, PointerEvent } from 'react';
import type { WidgetLayout } from '@irdashies/types';
import {
  ViewportGridSnapOptions,
  ViewportGridSnapState,
  snapLayoutPositionToViewportGrid,
} from './snapToViewportGrid';

interface UseDragWidgetOptions {
  layout: WidgetLayout;
  onLayoutChange: (layout: WidgetLayout) => void;
  enabled: boolean;
  snapOptions?: ViewportGridSnapOptions;
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
  snapOptions,
}: UseDragWidgetOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const layoutRef = useRef(layout);
  const snapStateRef = useRef<ViewportGridSnapState>({});

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
      snapStateRef.current = {};
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

      const nextLayout = {
        ...layoutRef.current,
        x: dragStateRef.current.startLayoutX + deltaX,
        y: dragStateRef.current.startLayoutY + deltaY,
      };

      const snapped = snapLayoutPositionToViewportGrid(
        nextLayout,
        { ...snapOptions, disabled: e.shiftKey },
        snapStateRef.current
      );

      snapStateRef.current = snapped.state;
      onLayoutChange(snapped.layout);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      snapStateRef.current = {};
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onLayoutChange, snapOptions]);

  return {
    isDragging,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      style: { cursor: enabled ? 'move' : 'default' },
    },
  };
}
