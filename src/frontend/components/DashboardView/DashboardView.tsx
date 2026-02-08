import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
  CSSProperties,
} from 'react';
import { useDashboard } from '@irdashies/context';
import { WIDGET_MAP } from '../../WidgetIndex';
import { getWidgetName } from '../../constants/widgetNames';
import { ResizeIcon, XIcon } from '@phosphor-icons/react';
import type { DashboardWidget } from '@irdashies/types';
import { useDragWidget, useResizeWidget } from '../WidgetContainer';
import { ResizeHandles } from '../WidgetContainer/ResizeHandle';

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DashboardWidgetItemProps {
  widget: DashboardWidget;
  position: WidgetPosition;
  showBorder: boolean;
  onPositionChange: (widgetId: string, position: WidgetPosition) => void;
  onClick: (widgetId: string) => void;
  onCloseBorder: () => void;
}

const DashboardWidgetItem = memo(
  ({
    widget,
    position,
    showBorder,
    onPositionChange,
    onClick,
    onCloseBorder,
  }: DashboardWidgetItemProps) => {
    const [localLayout, setLocalLayout] = useState(position);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined
    );

    // Sync local state when position prop changes externally
    useEffect(() => {
      setLocalLayout(position);
    }, [position]);

    const handleLayoutChange = useCallback(
      (newLayout: WidgetPosition) => {
        setLocalLayout(newLayout);

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          onPositionChange(widget.id, newLayout);
        }, 100);
      },
      [widget.id, onPositionChange]
    );

    // Flush pending save when interaction ends
    const flushPendingSave = useCallback(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }
      onPositionChange(widget.id, localLayout);
    }, [widget.id, localLayout, onPositionChange]);

    const { isDragging, dragHandleProps } = useDragWidget({
      layout: localLayout,
      onLayoutChange: handleLayoutChange,
      enabled: true,
    });

    const { isResizing, getResizeHandleProps } = useResizeWidget({
      layout: localLayout,
      onLayoutChange: handleLayoutChange,
      enabled: true,
    });

    const isInteracting = isDragging || isResizing;
    const prevInteractingRef = useRef(isInteracting);

    useEffect(() => {
      const wasInteracting = prevInteractingRef.current;
      prevInteractingRef.current = isInteracting;

      if (wasInteracting && !isInteracting) {
        flushPendingSave();
      }
    }, [isInteracting, flushPendingSave]);

    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    const WidgetComponent = WIDGET_MAP[widget.id];
    if (!WidgetComponent) {
      return null;
    }

    const widgetName = getWidgetName(widget.id);

    const containerStyle: CSSProperties = {
      position: 'absolute',
      left: localLayout.x,
      top: localLayout.y,
      width: localLayout.width,
      height: localLayout.height,
    };

    return (
      <div style={containerStyle} data-widget-id={widget.id}>
        {/* Drag handle - full widget area */}
        <div
          {...dragHandleProps}
          className="w-full h-full overflow-hidden text-white relative"
          onClick={() => onClick(widget.id)}
        >
          {/* Border when clicked */}
          {showBorder && (
            <div className="absolute inset-0 border-dashed border-2 border-sky-500 pointer-events-none z-20 flex items-start justify-end p-2">
              <div className="flex items-center gap-2 bg-sky-500 text-white text-sm font-semibold px-2 py-1 rounded">
                <ResizeIcon size={16} />
                <span>{widgetName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseBorder();
                  }}
                  className="pointer-events-auto ml-2 hover:bg-sky-600 rounded p-1 transition-colors"
                  title="Close"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>
          )}
          {/* Widget content */}
          <div
            className="w-full h-full p-2"
            style={{
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingTop: '8px',
            }}
          >
            <style>{`
              .widget-content::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <div className="widget-content w-full h-full">
              <WidgetComponent />
            </div>
          </div>
        </div>

        {/* Resize handles */}
        <ResizeHandles getResizeHandleProps={getResizeHandleProps} />
      </div>
    );
  }
);

DashboardWidgetItem.displayName = 'DashboardWidgetItem';

export const DashboardView = () => {
  const { currentDashboard, bridge, currentProfile } = useDashboard();
  const [widgetPositions, setWidgetPositions] = useState<
    Record<string, WidgetPosition>
  >({});
  const [showBorderForWidget, setShowBorderForWidget] = useState<string | null>(
    null
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<Record<string, WidgetPosition> | null>(null);
  const isSavingRef = useRef(false);

  const handleWidgetClick = useCallback((widgetId: string) => {
    setShowBorderForWidget(widgetId);
  }, []);

  const handleCloseBorder = useCallback(() => {
    setShowBorderForWidget(null);
  }, []);

  // Filter enabled widgets and deduplicate by ID
  const enabledWidgets = useMemo(() => {
    if (!currentDashboard?.widgets) {
      return [];
    }
    const seen = new Set<string>();
    const filtered = currentDashboard.widgets.filter((w) => {
      if (!w.enabled || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    return filtered;
  }, [currentDashboard]);

  // Initialize widget positions from dashboard config or use defaults
  const initialPositions = useMemo(() => {
    if (!currentDashboard) return {};

    const positions: Record<string, WidgetPosition> = {};
    let offsetX = 20;
    let offsetY = 20;

    enabledWidgets.forEach((widget) => {
      const widgetConfig = widget.config as Record<string, unknown>;
      const browserPos = widgetConfig?.browserPosition as
        | WidgetPosition
        | undefined;

      // Use saved browserPosition if available, otherwise use layout dimensions from Electron config
      if (browserPos && typeof browserPos.x === 'number') {
        positions[widget.id] = browserPos;
      } else {
        positions[widget.id] = {
          x: offsetX,
          y: offsetY,
          width: widget.layout?.width ?? 400,
          height: widget.layout?.height ?? 300,
        };

        // Cascade widgets slightly if no saved position
        offsetX += 30;
        offsetY += 30;

        // Wrap to top if too far down
        if (offsetY > 500) {
          offsetX += 450;
          offsetY = 20;
        }
      }
    });

    return positions;
  }, [currentDashboard, enabledWidgets]);

  const savePositions = useCallback(
    async (positions: Record<string, WidgetPosition>) => {
      if (!currentDashboard?.widgets || !currentProfile) return;

      try {
        const updatedWidgets = currentDashboard.widgets.map((widget) => {
          const widgetPosition = positions[widget.id];
          if (!widgetPosition) return widget;

          return {
            ...widget,
            config: {
              ...widget.config,
              browserPosition: widgetPosition,
            },
          };
        });

        const updatedDashboard = {
          ...currentDashboard,
          widgets: updatedWidgets,
        };

        bridge.saveDashboard(updatedDashboard, {
          profileId: currentProfile.id,
        });
      } catch (error) {
        console.error('Failed to save widget positions:', error);
      }
    },
    [currentDashboard, currentProfile, bridge]
  );

  const processPendingSave = useCallback(async () => {
    if (isSavingRef.current || !pendingSaveRef.current) return;

    const positionsToSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    isSavingRef.current = true;

    try {
      await savePositions(positionsToSave);
    } finally {
      isSavingRef.current = false;
      // Process any new pending saves that came in while we were saving
      if (pendingSaveRef.current) {
        setTimeout(() => processPendingSave(), 0);
      }
    }
  }, [savePositions]);

  const handlePositionChange = useCallback(
    (widgetId: string, position: WidgetPosition) => {
      setWidgetPositions((prev) => {
        // Initialize from initial positions if empty
        const base = Object.keys(prev).length === 0 ? initialPositions : prev;
        const newPositions = {
          ...base,
          [widgetId]: position,
        };

        // Queue this save - it will be processed after debounce delay
        pendingSaveRef.current = newPositions;

        // Debounce the actual save operation
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          processPendingSave();
        }, 250);

        return newPositions;
      });
    },
    [initialPositions, processPendingSave]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!currentDashboard || !currentProfile) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ background: 'transparent' }}
    >
      {enabledWidgets.map((widget) => {
        const position =
          Object.keys(widgetPositions).length > 0
            ? widgetPositions[widget.id]
            : initialPositions[widget.id];
        if (!position) return null;

        return (
          <DashboardWidgetItem
            key={widget.id}
            widget={widget}
            position={position}
            showBorder={showBorderForWidget === widget.id}
            onPositionChange={handlePositionChange}
            onClick={handleWidgetClick}
            onCloseBorder={handleCloseBorder}
          />
        );
      })}

      {enabledWidgets.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <div className="text-xl mb-2">No overlays enabled</div>
            <div className="text-sm">
              Enable overlays in Settings to see them here
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
