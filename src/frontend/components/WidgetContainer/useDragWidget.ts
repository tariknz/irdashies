import { useState, useCallback, useRef, useEffect, PointerEvent } from 'react';
import type { WidgetLayout } from '@irdashies/types';
import { perfMetrics } from '@irdashies/utils/perfMetrics';
import {
  ViewportGridSnapOptions,
  ViewportGridSnapState,
  snapLayoutPositionToViewportGrid,
} from './snapToViewportGrid';
import { isNearDisplayCenter, snapToDisplayCenter } from './displayCenter';
import { roundLayout } from './roundLayout';

interface UseDragWidgetOptions {
  layout: WidgetLayout;
  onLayoutChange: (layout: WidgetLayout) => void;
  enabled: boolean;
  snapOptions?: ViewportGridSnapOptions;
  /**
   * The display's horizontal middle, in screen coordinates. A widget whose
   * center comes close snaps onto it, and the center line shows once the
   * widget comes near it. Undefined before the display is known.
   */
  centerX?: number;
}

/**
 * The grid state without its left and right edge locks. While the center snap
 * places the widget, a lock the grid takes underneath is never seen; kept, it
 * would hold the widget at that edge for a moment once the snap lets go.
 */
const withoutHorizontalLocks = (
  state: ViewportGridSnapState
): ViewportGridSnapState => ({
  ...(state.top && { top: state.top }),
  ...(state.bottom && { bottom: state.bottom }),
});

interface DragState {
  startX: number;
  startY: number;
  startLayoutX: number;
  startLayoutY: number;
}

/**
 * Provides pointer-driven drag behaviour for a widget, with optional viewport
 * grid snapping and a snap onto the display's middle. Shift drags freely.
 */
export function useDragWidget({
  layout,
  onLayoutChange,
  enabled,
  snapOptions,
  centerX,
}: UseDragWidgetOptions) {
  const [isDragging, setIsDragging] = useState(false);
  // Once shown, the center line stays for the rest of the drag.
  const [showCenterGuide, setShowCenterGuide] = useState(false);
  const showCenterGuideRef = useRef(false);
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
      showCenterGuideRef.current = false;
      setShowCenterGuide(false);
      setIsDragging(true);
    },
    [enabled]
  );

  // Use window-level events for smooth dragging
  useEffect(() => {
    if (!isDragging) return;

    const placeWidget = (e: globalThis.PointerEvent) => {
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

      let placed = snapped.layout;
      if (centerX !== undefined) {
        if (!e.shiftKey) {
          placed = snapToDisplayCenter(placed, nextLayout, centerX);
          if (placed !== snapped.layout) {
            snapStateRef.current = withoutHorizontalLocks(snapped.state);
          }
        }
        if (
          !showCenterGuideRef.current &&
          isNearDisplayCenter(placed, centerX)
        ) {
          showCenterGuideRef.current = true;
          setShowCenterGuide(true);
        }
      }
      onLayoutChange(roundLayout(placed));
    };

    // Runs on every pointer move of a drag (R13.1).
    const handlePointerMove = (e: globalThis.PointerEvent) =>
      perfMetrics.measure('widgetDrag', () => placeWidget(e));

    // A cancelled pointer ends the drag as a release does: otherwise the line
    // stays up and the next moves, button up, still carry the widget.
    const endDrag = () => {
      dragStateRef.current = null;
      snapStateRef.current = {};
      showCenterGuideRef.current = false;
      setShowCenterGuide(false);
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [isDragging, onLayoutChange, snapOptions, centerX]);

  return {
    isDragging,
    showCenterGuide,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      style: { cursor: enabled ? 'move' : 'default' },
    },
  };
}
