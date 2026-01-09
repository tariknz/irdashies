import { useState, useMemo, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useDashboard } from '@irdashies/context';
import { WIDGET_MAP } from '../../WidgetIndex';

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DashboardView = () => {
  const { currentDashboard, currentProfile, bridge } = useDashboard();
  const [widgetPositions, setWidgetPositions] = useState<Record<string, WidgetPosition>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  console.log('[DashboardView] Rendering, currentDashboard:', currentDashboard);
  console.log('[DashboardView] currentProfile:', currentProfile);

  // Filter enabled widgets and deduplicate by ID
  const enabledWidgets = useMemo(() => {
    if (!currentDashboard?.widgets) return [];
    const seen = new Set<string>();
    return currentDashboard.widgets.filter(w => {
      if (!w.enabled || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
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

  const handlePositionChange = (widgetId: string, position: WidgetPosition) => {
    setWidgetPositions(prev => {
      // Initialize from initial positions if empty
      const base = Object.keys(prev).length === 0 ? initialPositions : prev;
      const newPositions = {
        ...base,
        [widgetId]: position,
      };

      // Debounce save to avoid too frequent updates
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (isSavingRef.current || !currentDashboard?.widgets) return; // Prevent overlapping saves
        
        isSavingRef.current = true;
        const updatedWidgets = currentDashboard.widgets.map(widget => {
          const widgetPosition = newPositions[widget.id];
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

        // Save to dashboard via bridge
        bridge.saveDashboard(updatedDashboard);
        console.log('💾 Saved widget positions:', newPositions);
        
        setTimeout(() => {
          isSavingRef.current = false;
        }, 500);
      }, 1000); // Save after 1 second of no changes

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

  if (!currentDashboard) {
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

        const widgetConfig = widget.config as Record<string, unknown>;
        const bgOpacity = (widgetConfig?.background as { opacity?: number })?.opacity ?? 80;

        return (
          <Rnd
            key={widget.id}
            position={{ x: position.x, y: position.y }}
            size={{ width: position.width, height: position.height }}
            onDragStop={(e, d) => {
              handlePositionChange(widget.id, {
                ...position,
                x: d.x,
                y: d.y,
              });
            }}
            onResizeStop={(e, direction, ref, delta, position) => {
              handlePositionChange(widget.id, {
                x: position.x,
                y: position.y,
                width: parseInt(ref.style.width),
                height: parseInt(ref.style.height),
              });
            }}
            bounds="parent"
            enableUserSelectHack={false}
          >
            <div 
              className="w-full h-full cursor-move"
              style={{
                backgroundColor: `rgba(30, 41, 59, ${bgOpacity / 100})`,
                overflow: 'hidden',
              }}
            >
              {/* Widget content - scrollable but no scrollbars visible */}
              <div 
                className="w-full h-full p-2"
                style={{
                  overflow: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
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
