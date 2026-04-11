import {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { ArrowsOutCardinal, X } from '@phosphor-icons/react';
import { useGeneralSettings } from '../../../src/frontend/context/DashboardContext/DashboardContext';
import { WidgetErrorBoundary } from '../components/WidgetErrorBoundary';
import {
  useDragWidget,
  useResizeWidget,
  ResizeHandles,
} from '../../../src/frontend/components/WidgetContainer';

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Wraps a widget in the overlay-window theme container.
 * Reads theme settings from the dashboard's generalSettings via useGeneralSettings,
 * mirroring the real ThemeManager behaviour.
 */
export function WidgetFrame({ children }: { children: ReactNode }) {
  const generalSettings = useGeneralSettings();
  const fontSize = generalSettings?.fontSize ?? 'sm';
  const colorPalette = generalSettings?.colorPalette ?? 'default';
  const fontType = generalSettings?.fontType ?? 'lato';
  const fontWeight = generalSettings?.fontWeight ?? 'normal';

  return (
    <div
      className={[
        'overlay-window',
        `overlay-theme-${fontSize}`,
        `overlay-theme-color-${colorPalette}`,
        `overlay-theme-font-face-${fontType}`,
        `overlay-theme-font-weight-${fontWeight}`,
        'w-full h-full overflow-hidden',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * A single draggable/resizable widget in the preview canvas.
 */
export const PreviewWidgetItem = memo(function PreviewWidgetItem({
  widgetId,
  label,
  component: Component,
  position,
  isSelected,
  onPositionChange,
  onSelect,
  onDeselect,
  onDoubleClick,
}: {
  widgetId: string;
  label: string;
  component: React.ComponentType;
  position: WidgetPosition;
  isSelected: boolean;
  onPositionChange: (id: string, pos: WidgetPosition) => void;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onDoubleClick: (id: string) => void;
}) {
  const [localLayout, setLocalLayout] = useState(position);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    setLocalLayout(position);
  }, [position]);

  const handleLayoutChange = useCallback(
    (newLayout: WidgetPosition) => {
      setLocalLayout(newLayout);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onPositionChange(widgetId, newLayout);
      }, 100);
    },
    [widgetId, onPositionChange]
  );

  const flushPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    onPositionChange(widgetId, localLayout);
  }, [widgetId, localLayout, onPositionChange]);

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
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: localLayout.x,
    top: localLayout.y,
    width: localLayout.width,
    height: localLayout.height,
  };

  return (
    <div style={containerStyle} data-widget-id={widgetId}>
      <div
        {...dragHandleProps}
        className="w-full h-full overflow-hidden text-white relative"
        onClick={() => onSelect(widgetId)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick(widgetId);
        }}
      >
        {/* Selection border */}
        {isSelected && (
          <div className="absolute inset-0 border-dashed border-2 border-sky-500 pointer-events-none z-20 flex items-start justify-end p-2">
            <div className="flex items-center gap-2 bg-sky-500 text-white text-sm font-semibold px-2 py-1 rounded pointer-events-auto">
              <ArrowsOutCardinal size={14} />
              <span>{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeselect();
                }}
                className="ml-1 hover:bg-sky-600 rounded p-0.5 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        {/* Widget content */}
        <WidgetFrame>
          <WidgetErrorBoundary widgetName={label}>
            <Component />
          </WidgetErrorBoundary>
        </WidgetFrame>
      </div>

      <ResizeHandles getResizeHandleProps={getResizeHandleProps} />
    </div>
  );
});
