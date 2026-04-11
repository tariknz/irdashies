import {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { LivePreviewProvider } from '../utils/mockSetup';
import { useGeneralSettings } from '../../../src/frontend/context/DashboardContext/DashboardContext';
import { WidgetErrorBoundary } from '../components/WidgetErrorBoundary';
import { DashboardReady } from '../components/DashboardReady';
import { Standings } from '../../../src/frontend/components/Standings/Standings';
import { Relative } from '../../../src/frontend/components/Standings/Relative';
import { Input } from '../../../src/frontend/components/Input';
import { Tachometer } from '../../../src/frontend/components/Tachometer/Tachometer';
import { Weather } from '../../../src/frontend/components/Weather';
import { Flag } from '../../../src/frontend/components/Flag';
import { InformationBar } from '../../../src/frontend/components/InformationBar/InformationBar';
import { TrackMap } from '../../../src/frontend/components/TrackMap/TrackMap';
import { FlatTrackMap } from '../../../src/frontend/components/TrackMap/FlatTrackMap';
import { FasterCarsFromBehind } from '../../../src/frontend/components/FasterCarsFromBehind/FasterCarsFromBehind';
import { FuelCalculator } from '../../../src/frontend/components/FuelCalculator';
import { BlindSpotMonitor } from '../../../src/frontend/components/BlindSpotMonitor/BlindSpotMonitor';
import { RejoinIndicator } from '../../../src/frontend/components/RejoinIndicator/RejoinIndicator';
import { PitlaneHelper } from '../../../src/frontend/components/PitlaneHelper/PitlaneHelper';
import { LapTimeLog } from '../../../src/frontend/components/LapTimeLog/LapTimeLog';
import { SlowCarAhead } from '../../../src/frontend/components/SlowCarAhead/SlowCarAhead';
import {
  useDragWidget,
  useResizeWidget,
  ResizeHandles,
} from '../../../src/frontend/components/WidgetContainer';
import { ArrowsOutCardinal, X } from '@phosphor-icons/react';
import { PreviewSettingsButton } from '../components/PreviewSettingsPanel';
import { defaultDashboard } from '../../../src/types/defaultDashboard';
import { useDashboard } from '../../../src/frontend/context/DashboardContext/DashboardContext';

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Look up a widget's default layout size from the project's defaultDashboard. */
function getDefaultSize(widgetId: string): { width: number; height: number } {
  const widget = defaultDashboard.widgets.find((w) => w.id === widgetId);
  return {
    width: widget?.layout?.width ?? 300,
    height: widget?.layout?.height ?? 200,
  };
}

const AVAILABLE_WIDGETS = [
  {
    id: 'standings',
    label: 'Standings',
    component: Standings,
    defaultOn: false,
  },
  { id: 'relative', label: 'Relative', component: Relative, defaultOn: true },
  { id: 'input', label: 'Input Trace', component: Input, defaultOn: true },
  {
    id: 'tachometer',
    label: 'Tachometer',
    component: Tachometer,
    defaultOn: false,
  },
  { id: 'weather', label: 'Weather', component: Weather, defaultOn: false },
  { id: 'flag', label: 'Flag', component: Flag, defaultOn: false },
  {
    id: 'infobar',
    label: 'Info Bar',
    component: InformationBar,
    defaultOn: false,
  },
  { id: 'map', label: 'Track Map', component: TrackMap, defaultOn: true },
  {
    id: 'flatmap',
    label: 'Flat Track Map',
    component: FlatTrackMap,
    defaultOn: false,
  },
  {
    id: 'fastercarsfrombehind',
    label: 'Faster Cars Behind',
    component: FasterCarsFromBehind,
    defaultOn: false,
  },
  {
    id: 'fuel',
    label: 'Fuel Calculator',
    component: FuelCalculator,
    defaultOn: false,
  },
  {
    id: 'blindspotmonitor',
    label: 'Blind Spot',
    component: BlindSpotMonitor,
    defaultOn: false,
  },
  {
    id: 'rejoin',
    label: 'Rejoin Indicator',
    component: RejoinIndicator,
    defaultOn: false,
  },
  {
    id: 'pitlanehelper',
    label: 'Pitlane Helper',
    component: PitlaneHelper,
    defaultOn: false,
  },
  {
    id: 'laptimelog',
    label: 'Lap Time Log',
    component: LapTimeLog,
    defaultOn: false,
  },
  {
    id: 'slowcarahead',
    label: 'Slow Car Ahead',
    component: SlowCarAhead,
    defaultOn: false,
  },
] as const;

// Default-on widgets: relative (top-left), track map (top-right),
// input (bottom-center). Positions are computed once the canvas is measured.

const PAD = 20;

function buildDefaultPositions(
  canvasW: number,
  canvasH: number
): Record<string, WidgetPosition> {
  const positions: Record<string, WidgetPosition> = Object.fromEntries(
    AVAILABLE_WIDGETS.map((w) => {
      const size = getDefaultSize(w.id);
      return [w.id, { x: PAD, y: PAD, ...size }];
    })
  );

  const relativeSize = getDefaultSize('relative');
  const mapSize = getDefaultSize('map');
  const inputSize = getDefaultSize('input');

  positions['relative'] = { x: PAD, y: PAD, ...relativeSize };
  positions['map'] = {
    x: canvasW - mapSize.width - PAD,
    y: PAD,
    ...mapSize,
  };
  positions['input'] = {
    x: Math.round((canvasW - inputSize.width) / 2),
    y: canvasH - inputSize.height - PAD,
    ...inputSize,
  };

  return positions;
}

/**
 * Wraps a widget in the overlay-window theme container.
 * Reads theme settings from the dashboard's generalSettings via useGeneralSettings,
 * mirroring the real ThemeManager behaviour.
 */
function WidgetFrame({ children }: { children: ReactNode }) {
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
const PreviewWidgetItem = memo(function PreviewWidgetItem({
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

/**
 * Syncs the toolbar's activeWidgets set into the dashboard context so the
 * settings panel's enabled toggle stays in sync with the Frame toolbar.
 */
function ActiveWidgetSync({ activeWidgets }: { activeWidgets: Set<string> }) {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const prevActiveRef = useRef<Set<string>>(activeWidgets);

  useEffect(() => {
    if (!currentDashboard || !onDashboardUpdated) return;
    // Only sync when activeWidgets actually changed (skip initial render)
    if (prevActiveRef.current === activeWidgets) return;
    prevActiveRef.current = activeWidgets;

    const needsUpdate = currentDashboard.widgets.some((w) => {
      const id = w.type ?? w.id;
      return w.enabled !== activeWidgets.has(id);
    });

    if (!needsUpdate) return;

    const updatedWidgets = currentDashboard.widgets.map((w) => {
      const id = w.type ?? w.id;
      const shouldBeEnabled = activeWidgets.has(id);
      if (w.enabled === shouldBeEnabled) return w;
      return { ...w, enabled: shouldBeEnabled };
    });

    onDashboardUpdated({ ...currentDashboard, widgets: updatedWidgets });
  }, [activeWidgets, currentDashboard, onDashboardUpdated]);

  return null;
}

export function LivePreview() {
  const [activeWidgets, setActiveWidgets] = useState<Set<string>>(
    () => new Set(AVAILABLE_WIDGETS.filter((w) => w.defaultOn).map((w) => w.id))
  );
  const [positions, setPositions] = useState<Record<string, WidgetPosition>>(
    () => buildDefaultPositions(1200, 700)
  );
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [settingsOpenWidget, setSettingsOpenWidget] = useState<string | null>(
    null
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasLaidOut = useRef(false);

  // Measure the canvas once it's rendered and recompute default positions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (hasLaidOut.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        hasLaidOut.current = true;
        setPositions(buildDefaultPositions(width, height));
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleWidget = (id: string) => {
    setActiveWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (selectedWidget === id) setSelectedWidget(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePositionChange = useCallback(
    (widgetId: string, position: WidgetPosition) => {
      setPositions((prev) => ({ ...prev, [widgetId]: position }));
    },
    []
  );

  const handleSelect = useCallback((widgetId: string) => {
    setSelectedWidget(widgetId);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedWidget(null);
  }, []);

  const handleDoubleClick = useCallback((widgetId: string) => {
    setSettingsOpenWidget(widgetId);
  }, []);

  return (
    <section
      id="preview"
      className="relative min-h-screen flex flex-col py-8 px-6"
    >
      {/* Compact section header */}
      <div className="mx-auto w-full max-w-450 mb-4">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
          See It In <span className="text-red-600">Action</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Toggle widgets in the toolbar to enable them. Click a widget to select
          it, drag to reposition, resize from edges, or double-click for
          settings.
        </p>
      </div>

      <LivePreviewProvider
        onDashboardSaved={(dashboard) => {
          setActiveWidgets((prev) => {
            const next = new Set(prev);
            const widgetIds = new Set<string>(
              AVAILABLE_WIDGETS.map((w) => w.id)
            );
            for (const widget of dashboard.widgets) {
              const id = widget.type ?? widget.id;
              if (!widgetIds.has(id)) continue;
              if (widget.enabled) {
                next.add(id);
              } else {
                next.delete(id);
                if (selectedWidget === id) setSelectedWidget(null);
              }
            }
            return next;
          });
        }}
      >
        <ActiveWidgetSync activeWidgets={activeWidgets} />
        {/* Preview frame */}
        <div className="mx-auto w-full max-w-450 flex-1 flex flex-col min-h-0">
          <div className="relative rounded-sm border border-slate-700/50 overflow-hidden carbon-fiber flex-1 flex flex-col">
            {/* Frame toolbar — traffic lights + controls integrated */}
            <div className="flex-none flex items-center gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-700/50">
              {/* Traffic lights */}
              <div className="flex gap-1.5 flex-none">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-slate-700/60 flex-none" />

              {/* Widget toggles — scrollable */}
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                {AVAILABLE_WIDGETS.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className={[
                      'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-sm transition-all border whitespace-nowrap flex-none',
                      activeWidgets.has(widget.id)
                        ? 'border-red-600/50 bg-red-600/10 text-slate-200'
                        : 'border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-slate-600/50',
                    ].join(' ')}
                  >
                    {widget.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-slate-700/60 flex-none" />

              {/* Settings */}
              <div className="flex-none">
                <PreviewSettingsButton
                  activeWidgets={activeWidgets}
                  onToggleWidget={toggleWidget}
                  openToWidget={settingsOpenWidget}
                  onClose={() => setSettingsOpenWidget(null)}
                />
              </div>
            </div>

            {/* Widget canvas — absolute positioned like the real DashboardView */}
            <div
              ref={canvasRef}
              className="relative flex-1 overflow-hidden"
              onClick={() => setSelectedWidget(null)}
            >
              {/* Background video */}
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src="/preview-bg.mp4" type="video/mp4" />
              </video>
              <DashboardReady>
                {AVAILABLE_WIDGETS.filter((w) => activeWidgets.has(w.id)).map(
                  (widget) => {
                    const pos = positions[widget.id];
                    if (!pos) return null;
                    return (
                      <PreviewWidgetItem
                        key={widget.id}
                        widgetId={widget.id}
                        label={widget.label}
                        component={widget.component}
                        position={pos}
                        isSelected={selectedWidget === widget.id}
                        onPositionChange={handlePositionChange}
                        onSelect={handleSelect}
                        onDeselect={handleDeselect}
                        onDoubleClick={handleDoubleClick}
                      />
                    );
                  }
                )}
              </DashboardReady>
            </div>
          </div>
        </div>
      </LivePreviewProvider>
    </section>
  );
}
