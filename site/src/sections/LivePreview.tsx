import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

const MOBILE_QUERY = '(max-width: 639px)';
const mobileMedia =
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY) : null;

function subscribeMobile(cb: () => void) {
  mobileMedia?.addEventListener('change', cb);
  return () => mobileMedia?.removeEventListener('change', cb);
}
function getSnapshotMobile() {
  return mobileMedia?.matches ?? false;
}

function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getSnapshotMobile);
}
import { LivePreviewProvider } from '../utils/mockSetup';
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
import { PreviewSettingsButton } from '../components/PreviewSettingsPanel';
import { defaultDashboard } from '../../../src/types/defaultDashboard';
import { CoachMarks } from './CoachMarks';
import {
  PreviewWidgetItem,
  WidgetFrame,
  type WidgetPosition,
} from './PreviewWidgetItem';
import { ActiveWidgetSync } from './ActiveWidgetSync';

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

export function LivePreview() {
  const isMobile = useIsMobile();
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
  const [showCoachMarks, setShowCoachMarks] = useState(true);
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
      if (isMobile) {
        // Radio behaviour: one widget at a time
        return prev.has(id) ? new Set<string>() : new Set([id]);
      }
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
          {isMobile
            ? 'Tap the toolbar to preview different widgets. Try the full interactive experience on desktop.'
            : 'Toggle widgets in the toolbar to enable them. Click a widget to select it, drag to reposition, resize from edges, or double-click for settings.'}
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
            {/* Frame toolbar */}
            <div className="flex-none flex items-center gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-700/50">
              {/* Traffic lights — desktop only */}
              {!isMobile && (
                <>
                  <div className="flex gap-1.5 flex-none">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="w-px h-4 bg-slate-700/60 flex-none" />
                </>
              )}

              {/* Widget toggles — scrollable */}
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                {AVAILABLE_WIDGETS.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className={[
                      'font-bold uppercase tracking-wide rounded-sm transition-all border whitespace-nowrap flex-none',
                      isMobile
                        ? 'px-2.5 py-1 text-[11px]'
                        : 'px-2 py-0.5 text-[10px]',
                      activeWidgets.has(widget.id)
                        ? 'border-red-600/50 bg-red-600/10 text-slate-200'
                        : 'border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-slate-600/50',
                    ].join(' ')}
                  >
                    {widget.label}
                  </button>
                ))}
              </div>

              {/* Settings — desktop only */}
              {!isMobile && (
                <>
                  <div className="w-px h-4 bg-slate-700/60 flex-none" />
                  <div className="flex-none">
                    <PreviewSettingsButton
                      activeWidgets={activeWidgets}
                      onToggleWidget={toggleWidget}
                      openToWidget={settingsOpenWidget}
                      onClose={() => setSettingsOpenWidget(null)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Coach marks overlay — desktop only */}
            {!isMobile && showCoachMarks && (
              <CoachMarks onDismiss={() => setShowCoachMarks(false)} />
            )}

            {/* Widget canvas */}
            <div
              ref={canvasRef}
              className="relative flex-1 overflow-hidden"
              onClick={isMobile ? undefined : () => setSelectedWidget(null)}
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
                {isMobile
                  ? // Mobile: single static widget, no interactions
                    (() => {
                      const active = AVAILABLE_WIDGETS.find((w) =>
                        activeWidgets.has(w.id)
                      );
                      if (!active) return null;
                      const Component = active.component;
                      return (
                        <div className="relative w-full h-full">
                          <WidgetFrame>
                            <WidgetErrorBoundary widgetName={active.label}>
                              <Component />
                            </WidgetErrorBoundary>
                          </WidgetFrame>
                        </div>
                      );
                    })()
                  : // Desktop: draggable/resizable widgets
                    AVAILABLE_WIDGETS.filter((w) =>
                      activeWidgets.has(w.id)
                    ).map((widget) => {
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
                    })}
              </DashboardReady>
            </div>
          </div>
        </div>
      </LivePreviewProvider>
    </section>
  );
}
