import {
  memo,
  useCallback,
  useRef,
  useState,
  useEffect,
  CSSProperties,
} from 'react';
import type { DashboardWidget, WidgetLayout } from '@irdashies/types';
import { useDragWidget } from './useDragWidget';
import { useResizeWidget, ResizeDirection } from './useResizeWidget';
import { getWidgetName } from '../../constants/widgetNames';
import { ResizeIcon } from '@phosphor-icons/react';

export interface WidgetContainerProps {
  widget: DashboardWidget;
  editMode: boolean;
  zIndex: number;
  onLayoutChange: (widgetId: string, layout: WidgetLayout) => void;
  children: React.ReactNode;
}

const RESIZE_HANDLE_SIZE = 8;

export const WidgetContainer = memo(
  ({
    widget,
    editMode,
    zIndex,
    onLayoutChange,
    children,
  }: WidgetContainerProps) => {
    const { id, layout } = widget;
    const [localLayout, setLocalLayout] = useState(layout);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined
    );
    const pendingLayoutRef = useRef<WidgetLayout | null>(null);

    const handleLayoutChange = useCallback(
      (newLayout: WidgetLayout) => {
        setLocalLayout(newLayout);
        pendingLayoutRef.current = newLayout;

        // Debounce the save to avoid excessive IPC calls during drag/resize
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          onLayoutChange(id, newLayout);
          pendingLayoutRef.current = null;
        }, 100);
      },
      [id, onLayoutChange]
    );

    // Flush pending save immediately when interaction ends
    const flushPendingSave = useCallback(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }
      if (pendingLayoutRef.current) {
        onLayoutChange(id, pendingLayoutRef.current);
        pendingLayoutRef.current = null;
      }
    }, [id, onLayoutChange]);

    const { isDragging, dragHandleProps } = useDragWidget({
      layout: localLayout,
      onLayoutChange: handleLayoutChange,
      enabled: editMode,
    });

    const { isResizing, getResizeHandleProps } = useResizeWidget({
      layout: localLayout,
      onLayoutChange: handleLayoutChange,
      enabled: editMode,
    });

    // Use local state during interaction, otherwise use prop
    const isInteracting = isDragging || isResizing;
    const prevInteractingRef = useRef(isInteracting);
    const justFlushedRef = useRef(false);

    // Flush save and sync state when interaction ends
    useEffect(() => {
      const wasInteracting = prevInteractingRef.current;
      prevInteractingRef.current = isInteracting;

      if (wasInteracting && !isInteracting) {
        // Interaction just ended - flush the pending save immediately
        // Mark that we just flushed so sync effect doesn't reset to old prop
        justFlushedRef.current = true;
        flushPendingSave();
      }
    }, [isInteracting, flushPendingSave]);

    // Sync local state when prop changes externally (e.g., from settings)
    // Skip if we just flushed (prop hasn't caught up yet) or if interacting
    useEffect(() => {
      if (isInteracting) return;

      if (justFlushedRef.current) {
        // Check if prop now matches our local state (save completed)
        if (
          layout.x === localLayout.x &&
          layout.y === localLayout.y &&
          layout.width === localLayout.width &&
          layout.height === localLayout.height
        ) {
          justFlushedRef.current = false;
        }
        // Don't sync yet - wait for prop to catch up
        return;
      }

      // Prop changed externally - sync to it
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalLayout(layout);
    }, [layout, localLayout, isInteracting]);

    // Always use localLayout for display
    const displayedLayout = localLayout;

    const containerStyle: CSSProperties = {
      position: 'absolute',
      left: displayedLayout.x,
      top: displayedLayout.y,
      width: displayedLayout.width,
      height: displayedLayout.height,
      zIndex,
      pointerEvents: editMode ? 'auto' : 'none',
    };

    const widgetName = getWidgetName(id);

    return (
      <div style={containerStyle} data-widget-id={id}>
        {/* Widget content */}
        <div
          className="w-full h-full"
          style={{ pointerEvents: editMode ? 'none' : 'auto' }}
        >
          {children}
        </div>

        {/* Edit mode overlay */}
        {editMode && (
          <>
            {/* Drag handle (entire top area) */}
            <div
              {...dragHandleProps}
              className={[
                'absolute inset-0 border-2 border-sky-500',
                isDragging || isResizing
                  ? 'border-sky-400'
                  : 'animate-pulse-border',
              ].join(' ')}
            >
              {/* Label */}
              <div
                className="absolute top-0 right-0 py-1 px-2 bg-sky-500 text-white text-sm flex items-center gap-1"
                style={{ cursor: 'move' }}
              >
                <ResizeIcon size={14} />
                <span>{widgetName}</span>
              </div>
            </div>

            {/* Resize handles */}
            <ResizeHandle direction="n" getProps={getResizeHandleProps} />
            <ResizeHandle direction="s" getProps={getResizeHandleProps} />
            <ResizeHandle direction="e" getProps={getResizeHandleProps} />
            <ResizeHandle direction="w" getProps={getResizeHandleProps} />
            <ResizeHandle direction="ne" getProps={getResizeHandleProps} />
            <ResizeHandle direction="nw" getProps={getResizeHandleProps} />
            <ResizeHandle direction="se" getProps={getResizeHandleProps} />
            <ResizeHandle direction="sw" getProps={getResizeHandleProps} />
          </>
        )}
      </div>
    );
  }
);

WidgetContainer.displayName = 'WidgetContainer';

interface ResizeHandleProps {
  direction: ResizeDirection;
  getProps: (direction: ResizeDirection) => Record<string, unknown>;
}

const ResizeHandle = memo(({ direction, getProps }: ResizeHandleProps) => {
  const props = getProps(direction);
  const style = getHandleStyle(direction);

  return (
    <div
      {...props}
      className="absolute bg-sky-500 opacity-0 hover:opacity-100 transition-opacity"
      style={style}
    />
  );
});

ResizeHandle.displayName = 'ResizeHandle';

function getHandleStyle(direction: ResizeDirection): CSSProperties {
  const half = RESIZE_HANDLE_SIZE / 2;
  const base: CSSProperties = {
    position: 'absolute',
  };

  switch (direction) {
    case 'n':
      return {
        ...base,
        top: -half,
        left: RESIZE_HANDLE_SIZE,
        right: RESIZE_HANDLE_SIZE,
        height: RESIZE_HANDLE_SIZE,
        cursor: 'ns-resize',
      };
    case 's':
      return {
        ...base,
        bottom: -half,
        left: RESIZE_HANDLE_SIZE,
        right: RESIZE_HANDLE_SIZE,
        height: RESIZE_HANDLE_SIZE,
        cursor: 'ns-resize',
      };
    case 'e':
      return {
        ...base,
        right: -half,
        top: RESIZE_HANDLE_SIZE,
        bottom: RESIZE_HANDLE_SIZE,
        width: RESIZE_HANDLE_SIZE,
        cursor: 'ew-resize',
      };
    case 'w':
      return {
        ...base,
        left: -half,
        top: RESIZE_HANDLE_SIZE,
        bottom: RESIZE_HANDLE_SIZE,
        width: RESIZE_HANDLE_SIZE,
        cursor: 'ew-resize',
      };
    case 'ne':
      return {
        ...base,
        top: -half,
        right: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nesw-resize',
        borderRadius: '0 4px 0 0',
      };
    case 'nw':
      return {
        ...base,
        top: -half,
        left: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nwse-resize',
        borderRadius: '4px 0 0 0',
      };
    case 'se':
      return {
        ...base,
        bottom: -half,
        right: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nwse-resize',
        borderRadius: '0 0 4px 0',
      };
    case 'sw':
      return {
        ...base,
        bottom: -half,
        left: -half,
        width: RESIZE_HANDLE_SIZE * 2,
        height: RESIZE_HANDLE_SIZE * 2,
        cursor: 'nesw-resize',
        borderRadius: '0 0 0 4px',
      };
  }
}
