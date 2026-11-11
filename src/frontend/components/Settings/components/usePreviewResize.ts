import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, KeyboardEvent } from 'react';
import {
  resizeWidgetLayout,
  type ResizeDirection,
} from '@irdashies/domain/widgetPresentation/resizeWidget';
import type { PreviewViewport } from '@irdashies/domain/widgetPreview/viewport';
import type { WidgetLayout } from '@irdashies/types';

const labels: Record<ResizeDirection, string> = {
  n: 'top',
  s: 'bottom',
  e: 'right',
  w: 'left',
  ne: 'top right',
  nw: 'top left',
  se: 'bottom right',
  sw: 'bottom left',
};

export function usePreviewResize({
  width,
  height,
  enabled,
  freeze,
  setPan,
  onSizeChange,
}: {
  width: number;
  height: number;
  enabled: boolean;
  freeze: () => PreviewViewport;
  setPan: (pan: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
}) {
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scale: number;
    layout: WidgetLayout;
    direction: ResizeDirection;
  } | null>(null);
  useEffect(() => {
    if (!enabled) {
      drag.current = null;
      setResizing(false);
    }
  }, [enabled]);
  const layoutAt = (view: PreviewViewport): WidgetLayout => ({
    x: view.pan.x / view.scale - width / 2,
    y: view.pan.y / view.scale - height / 2,
    width,
    height,
  });
  const resize = (
    layout: WidgetLayout,
    direction: ResizeDirection,
    dx: number,
    dy: number,
    scale: number
  ) => {
    const next = resizeWidgetLayout(layout, direction, dx, dy);
    onSizeChange({
      width: Math.round(next.width),
      height: Math.round(next.height),
    });
    setPan({
      x: (next.x + next.width / 2) * scale,
      y: (next.y + next.height / 2) * scale,
    });
  };
  const getResizeHandleProps = (direction: ResizeDirection) => ({
    role: 'button',
    tabIndex: enabled ? 0 : -1,
    'aria-label': `Resize widget ${labels[direction]}`,
    title: 'Drag to resize the preview frame; arrow keys also resize',
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || drag.current) return;
      event.stopPropagation();
      event.preventDefault();
      const view = freeze();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scale: view.scale,
        layout: layoutAt(view),
        direction,
      };
      setResizing(true);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (start?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      resize(
        start.layout,
        start.direction,
        (event.clientX - start.x) / start.scale,
        (event.clientY - start.y) / start.scale,
        start.scale
      );
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      event.currentTarget.releasePointerCapture(event.pointerId);
      drag.current = null;
      setResizing(false);
    },
    onLostPointerCapture: () => {
      drag.current = null;
      setResizing(false);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!enabled) return;
      const step = event.shiftKey ? 10 : 1;
      let dx = 0,
        dy = 0;
      switch (event.key) {
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
        case 'ArrowUp':
          dy = -step;
          break;
        case 'ArrowDown':
          dy = step;
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
      const view = freeze();
      resize(layoutAt(view), direction, dx, dy, view.scale);
    },
  });
  return { resizing, getResizeHandleProps };
}
