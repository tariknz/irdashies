import { useState, useMemo, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useDashboard } from '@irdashies/context';
import { WIDGET_MAP } from '../../WidgetIndex';
import { getWidgetName } from '../../constants/widgetNames';

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DashboardView = () => {
  const { currentDashboard, bridge, currentProfile } = useDashboard();
  const [widgetPositions, setWidgetPositions] = useState<Record<string, WidgetPosition>>({});
  const [interactingWidget, setInteractingWidget] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<Record<string, WidgetPosition> | null>(null);
  const isSavingRef = useRef(false);


  // Filter enabled widgets and deduplicate by ID
  const enabledWidgets = useMemo(() => {
    if (!currentDashboard?.widgets) {
      return [];
    }
    const seen = new Set<string>();
    const filtered = currentDashboard.widgets.filter(w => {
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
      const browserPos = widgetConfig?.browserPosition as WidgetPosition | undefined;

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

  const savePositions = async (positions: Record<string, WidgetPosition>) => {
    if (!currentDashboard?.widgets || !currentProfile) return;

    try {
      const updatedWidgets = currentDashboard.widgets.map(widget => {
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

      console.log('💾 Saving widget positions for profile:', currentProfile.id, 'with positions:', positions);
      bridge.saveDashboard(updatedDashboard, { profileId: currentProfile.id });
      console.log('💾 Saved widget positions:', positions);
    } catch (error) {
      console.error('Failed to save widget positions:', error);
    }
  };

  const processPendingSave = async () => {
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
  };

  const handlePositionChange = (widgetId: string, position: WidgetPosition) => {
    setWidgetPositions(prev => {
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
      }, 250); // Reduced delay for faster auto-saving

      return newPositions;
    });
  };

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
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden relative" style={{ background: 'transparent' }}>
      {enabledWidgets.map((widget) => {
        const WidgetComponent = WIDGET_MAP[widget.id];
        if (!WidgetComponent) {
          console.warn(`Widget ${widget.id} not found in WIDGET_MAP`);
          return null;
        }

        const position = Object.keys(widgetPositions).length > 0
          ? widgetPositions[widget.id]
          : initialPositions[widget.id];
        if (!position) return null;

        const widgetName = getWidgetName(widget.id);
        const isInteracting = interactingWidget === widget.id;

        return (
          <Rnd
            key={widget.id}
            position={{ x: position.x, y: position.y }}
            size={{ width: position.width, height: position.height }}
            onDragStart={() => {
              setInteractingWidget(widget.id);
            }}
            onDragStop={(e, d) => {
              setInteractingWidget(null);
              const newPosition = {
                ...position,
                x: d.x,
                y: d.y,
              };
              handlePositionChange(widget.id, newPosition);
            }}
            onResizeStart={() => {
              setInteractingWidget(widget.id);
            }}
            onResizeStop={(e, direction, ref, delta, position) => {
              setInteractingWidget(null);
              const newPosition = {
                x: position.x,
                y: position.y,
                width: parseInt(ref.style.width),
                height: parseInt(ref.style.height),
              };
              handlePositionChange(widget.id, newPosition);
            }}
            bounds="parent"
            enableUserSelectHack={false}
          >
            <div
              className={`w-full h-full cursor-move overflow-hidden ${isInteracting ? 'border-2 border-dashed border-blue-400' : ''}`}
            >
              {/* Title overlay when interacting */}
              {isInteracting && (
                <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-xs px-2 py-1 font-medium z-10">
                  {widgetName}
                </div>
              )}
              {/* Widget content - scrollable but no scrollbars visible */}
              <div
                className="w-full h-full p-2"
                style={{
                  overflow: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  paddingTop: isInteracting ? '24px' : '8px', // Add space for title when interacting
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
          </Rnd>
        );
      })}

      {enabledWidgets.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl mb-2">No overlays enabled</div>
            <div className="text-sm">Enable overlays in Settings to see them here</div>
          </div>
        </div>
      )}
    </div>
  );
};
