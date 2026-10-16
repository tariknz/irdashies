import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ArrowCounterClockwise,
  ArrowsIn,
  ArrowsOut,
  CaretDown,
  Check,
} from '@phosphor-icons/react';
import { WIDGET_MAP } from '@irdashies/frontend/WidgetIndex';
import { WIDGET_NAMES } from '@irdashies/frontend/constants/widgetNames';
import { SectorTimingUpdater } from '@irdashies/frontend/context/SectorTimingStore/SectorTimingUpdater';
import { LapTraceUpdater } from '@irdashies/frontend/components/OverlayContainer/LapTraceUpdater';
import { ReferenceStoreProvider } from '@irdashies/context';
import { defaultDashboard, type WidgetId } from '@irdashies/types';
import { EXCLUDED_WIDGETS } from '../utils/previewWidgets';
import { DashboardReady } from '../components/DashboardReady';
import { PreviewSettingsButton } from '../components/PreviewSettingsPanel';
import { WidgetErrorBoundary } from '../components/WidgetErrorBoundary';
import { LivePreviewProvider } from '../utils/mockSetup';
import { ActiveWidgetSync } from './ActiveWidgetSync';
import {
  PreviewWidgetContent,
  PreviewWidgetItem,
  WidgetFrame,
  type WidgetPosition,
} from './PreviewWidgetItem';

const compactMedia = window.matchMedia('(max-width: 1023px)');
const subscribeCompact = (cb: () => void) => {
  compactMedia.addEventListener('change', cb);
  return () => compactMedia.removeEventListener('change', cb);
};
const getCompactSnapshot = () => compactMedia.matches;

const DEFAULT_WIDGETS = new Set<WidgetId>(['relative', 'input', 'map']);
const FEATURED_WIDGETS = [
  'relative',
  'input',
  'map',
  'fuel',
  'radar',
  'laptrace',
];
const PAD = 20;

const AVAILABLE_WIDGETS = (Object.keys(WIDGET_MAP) as WidgetId[])
  .filter((id) => !EXCLUDED_WIDGETS.has(id))
  .map((id) => ({
    id,
    label: WIDGET_NAMES[id],
    component: WIDGET_MAP[id] as React.ComponentType<unknown>,
  }));

function getDefaultSize(widgetId: string) {
  if (widgetId === 'gantry') return { width: 1000, height: 560 };
  const widget = defaultDashboard.widgets.find((w) => w.id === widgetId);
  return {
    width: widget?.layout?.width ?? 300,
    height: widget?.layout?.height ?? 200,
  };
}

function buildDefaultPositions(canvasW: number, canvasH: number) {
  const positions: Record<string, WidgetPosition> = Object.fromEntries(
    AVAILABLE_WIDGETS.map((widget) => {
      const size = getDefaultSize(widget.id);
      return [
        widget.id,
        {
          x: PAD,
          y: PAD,
          width: Math.min(size.width, canvasW - PAD * 2),
          height: Math.min(size.height, canvasH - PAD * 2),
        },
      ];
    })
  );
  positions.map.x = canvasW - positions.map.width - PAD;
  positions.input.x = (canvasW - positions.input.width) / 2;
  positions.input.y = canvasH - positions.input.height - PAD;
  return positions;
}

export function LivePreview() {
  const [expanded, setExpanded] = useState(false);
  const compact = useSyncExternalStore(subscribeCompact, getCompactSnapshot);
  const [desktopWidgets, setDesktopWidgets] = useState<Set<string>>(
    () => new Set(DEFAULT_WIDGETS)
  );
  const [compactWidget, setCompactWidget] = useState('relative');
  const activeWidgets = useMemo(
    () => (compact ? new Set([compactWidget]) : desktopWidgets),
    [compact, compactWidget, desktopWidgets]
  );
  const [initialWidgets] = useState(() =>
    defaultDashboard.widgets.map((w) => ({
      ...w,
      enabled: activeWidgets.has(w.type ?? w.id),
    }))
  );
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 620 });
  const [positions, setPositions] = useState(() =>
    buildDefaultPositions(1200, 620)
  );
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [settingsOpenWidget, setSettingsOpenWidget] = useState<string | null>(
    null
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const measured = useRef(false);
  const desktopCanvasSize = useRef({ width: 1200, height: 620 });

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      setCanvasSize({ width, height });
      if (compact) return;
      desktopCanvasSize.current = { width, height };
      setPositions((previous) => {
        if (!measured.current) {
          measured.current = true;
          return buildDefaultPositions(width, height);
        }
        return Object.fromEntries(
          Object.entries(previous).map(([id, pos]) => {
            const nextWidth = Math.min(pos.width, width - PAD * 2);
            const nextHeight = Math.min(pos.height, height - PAD * 2);
            return [
              id,
              {
                ...pos,
                width: nextWidth,
                height: nextHeight,
                x: Math.max(0, Math.min(pos.x, width - nextWidth)),
                y: Math.max(0, Math.min(pos.y, height - nextHeight)),
              },
            ];
          })
        );
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (media.matches) videoRef.current?.pause();
      else void videoRef.current?.play().catch(() => undefined);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        if (menuRef.current) menuRef.current.open = false;
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const toggleWidget = (id: string) => {
    if (compact) {
      setCompactWidget(id);
      return;
    }
    setDesktopWidgets((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedWidget(null);
  };

  const reset = () => {
    setDesktopWidgets(new Set(DEFAULT_WIDGETS));
    setCompactWidget('relative');
    setPositions(
      buildDefaultPositions(
        desktopCanvasSize.current.width,
        desktopCanvasSize.current.height
      )
    );
    setSelectedWidget(null);
    setSettingsOpenWidget(null);
  };

  const handlePositionChange = useCallback(
    (id: string, position: WidgetPosition) => {
      setPositions((previous) => ({ ...previous, [id]: position }));
    },
    []
  );
  const handleSelect = useCallback((id: string) => setSelectedWidget(id), []);
  const handleDisable = useCallback((id: string) => {
    setDesktopWidgets((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setSelectedWidget(null);
  }, []);
  const handleOpenSettings = useCallback(
    (id: string) => setSettingsOpenWidget(id),
    []
  );

  const singleWidget = AVAILABLE_WIDGETS.find((w) => w.id === compactWidget);
  const singleSize = getDefaultSize(compactWidget);
  const singleScale = Math.min(
    1,
    (canvasSize.width - 24) / singleSize.width,
    (canvasSize.height - 24) / singleSize.height
  );

  return (
    <section className="relative py-8 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-7xl mb-4">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
          See It In <span className="text-red-600">Action</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {compact
            ? 'Sample data. Choose a widget to preview.'
            : 'Sample data. Choose widgets, drag to move, and resize from the edges.'}
        </p>
      </div>
      <LivePreviewProvider
        widgets={initialWidgets}
        onDashboardSaved={(dashboard) => {
          if (compact) return;
          setDesktopWidgets(
            new Set(
              dashboard.widgets
                .filter(
                  (w) =>
                    w.enabled &&
                    !EXCLUDED_WIDGETS.has((w.type ?? w.id) as WidgetId)
                )
                .map((w) => w.type ?? w.id)
            )
          );
        }}
      >
        <WidgetErrorBoundary
          widgetName="Widget sync"
          fallback={null}
          resetAfterMs={2000}
        >
          <ActiveWidgetSync activeWidgets={activeWidgets} />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary
          widgetName="Preview telemetry"
          fallback={null}
          resetAfterMs={2000}
        >
          <SectorTimingUpdater />
          <ReferenceStoreProvider bridge={window.channelBridge} />
          <LapTraceUpdater browser />
        </WidgetErrorBoundary>
        <div
          className={
            expanded
              ? 'fixed inset-0 z-60 flex h-dvh w-full flex-col bg-slate-900'
              : 'mx-auto w-full max-w-7xl border border-slate-700/50 rounded-sm'
          }
        >
          <div className="relative z-30 flex shrink-0 flex-wrap items-center gap-3 p-3 bg-slate-900 rounded-t-sm border-b border-slate-700/50">
            {compact ? (
              <label className="flex-1 flex items-center gap-3 text-sm text-slate-300">
                Widget
                <select
                  value={compactWidget}
                  onChange={(event) => setCompactWidget(event.target.value)}
                  className="min-w-0 flex-1 rounded-sm bg-slate-800 border border-slate-600 px-3 py-2 text-white"
                >
                  {AVAILABLE_WIDGETS.map((widget) => (
                    <option key={widget.id} value={widget.id}>
                      {widget.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <div
                  role="group"
                  aria-label="Featured widgets"
                  className="flex flex-wrap flex-1 gap-2"
                >
                  {AVAILABLE_WIDGETS.filter((widget) =>
                    FEATURED_WIDGETS.includes(widget.id)
                  ).map((widget) => (
                    <button
                      key={widget.id}
                      aria-pressed={activeWidgets.has(widget.id)}
                      onClick={() => toggleWidget(widget.id)}
                      className={[
                        'rounded-sm border px-3 py-1.5 text-xs font-bold transition-colors',
                        activeWidgets.has(widget.id)
                          ? 'border-red-600/60 bg-red-600/15 text-white'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800',
                      ].join(' ')}
                    >
                      {widget.label}
                    </button>
                  ))}
                </div>
                <details
                  ref={menuRef}
                  className="relative"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      event.currentTarget.open = false;
                      event.currentTarget.querySelector('summary')?.focus();
                    }
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-300 hover:text-white px-2 py-2">
                    All widgets <CaretDown size={14} />
                  </summary>
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto rounded-sm border border-slate-600 bg-slate-900 p-2 shadow-xl">
                    {AVAILABLE_WIDGETS.map((widget) => (
                      <button
                        key={widget.id}
                        aria-pressed={activeWidgets.has(widget.id)}
                        onClick={() => toggleWidget(widget.id)}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <Check
                          size={14}
                          className={
                            activeWidgets.has(widget.id)
                              ? 'text-red-500'
                              : 'invisible'
                          }
                        />
                        {widget.label}
                      </button>
                    ))}
                  </div>
                </details>
                <PreviewSettingsButton
                  activeWidgets={activeWidgets}
                  onToggleWidget={toggleWidget}
                  openToWidget={settingsOpenWidget}
                  onClose={() => setSettingsOpenWidget(null)}
                />
              </>
            )}
            <button
              onClick={reset}
              aria-label="Reset preview layout"
              title="Reset preview layout"
              className="p-2 text-slate-400 hover:text-white"
            >
              <ArrowCounterClockwise size={18} />
            </button>
            <button
              onClick={() => setExpanded((previous) => !previous)}
              aria-label={
                expanded ? 'Exit fullscreen preview' : 'Expand preview'
              }
              aria-pressed={expanded}
              title={
                expanded ? 'Exit fullscreen preview (Esc)' : 'Expand preview'
              }
              className="p-2 text-slate-400 hover:text-white"
            >
              {expanded ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
            </button>
          </div>
          <div
            ref={canvasRef}
            className={[
              'relative overflow-hidden rounded-b-sm bg-slate-900',
              expanded ? 'min-h-0 flex-1' : 'h-90 sm:h-120 lg:h-155',
            ].join(' ')}
            onClick={compact ? undefined : () => setSelectedWidget(null)}
          >
            <video
              ref={videoRef}
              loop
              muted
              playsInline
              preload="none"
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/preview-bg.mp4" type="video/mp4" />
            </video>
            <DashboardReady>
              {compact
                ? singleWidget && (
                    <div
                      data-preview-widget={singleWidget.id}
                      className="absolute origin-top-left"
                      style={{
                        width: singleSize.width,
                        height: singleSize.height,
                        left:
                          (canvasSize.width - singleSize.width * singleScale) /
                          2,
                        top: 12,
                        transform: `scale(${singleScale})`,
                      }}
                    >
                      <WidgetFrame>
                        <WidgetErrorBoundary widgetName={singleWidget.label}>
                          <PreviewWidgetContent
                            widgetId={singleWidget.id}
                            component={singleWidget.component}
                          />
                        </WidgetErrorBoundary>
                      </WidgetFrame>
                    </div>
                  )
                : AVAILABLE_WIDGETS.filter((widget) =>
                    activeWidgets.has(widget.id)
                  ).map((widget) => (
                    <PreviewWidgetItem
                      key={widget.id}
                      widgetId={widget.id}
                      label={widget.label}
                      component={widget.component}
                      position={positions[widget.id]}
                      isSelected={selectedWidget === widget.id}
                      onPositionChange={handlePositionChange}
                      onSelect={handleSelect}
                      onDisable={handleDisable}
                      onOpenSettings={handleOpenSettings}
                    />
                  ))}
            </DashboardReady>
          </div>
        </div>
      </LivePreviewProvider>
    </section>
  );
}
