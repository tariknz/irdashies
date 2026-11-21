import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GearIcon } from '@phosphor-icons/react';
import {
  SectorTimingUpdater,
  useActiveSimulator,
  useDashboard,
  useRunningState,
  useSimWidgetSupport,
} from '@irdashies/context';
import {
  resolveDockPanels,
  type ResolvedDock,
  type ResolvedDockPanel,
} from '@irdashies/types';
import { WidgetRuntimeProvider } from '../../widgetRuntime';
import { RendererDataProviders } from '../RendererDataProviders/RendererDataProviders';
import {
  DockPanelContent,
  DockPanelHeader,
  dockPanelLabel,
  dockPanelSettingsTarget,
} from './components/DockPanel';
import { useDockCollapsed } from './hooks/useDockCollapsed';
import { PanelDivider } from './components/PanelDivider';
import {
  MIN_PANEL_PERCENT,
  dividerPosition,
  equalWidths,
  moveDivider,
  readPanelWidths,
  writePanelWidths,
} from './panelWidths';

const SECTOR_TIMING_TYPES = new Set(['map', 'flatmap']);

/**
 * The dock as the saved dashboard describes it, less any panel the running sim
 * cannot support. Empty when it is off.
 */
export const useGantryDock = (): ResolvedDock => {
  const { currentDashboard } = useDashboard();
  const simulator = useActiveSimulator();
  const support = useSimWidgetSupport();
  return useMemo(
    () => resolveDockPanels(currentDashboard, { support, simulator }),
    [currentDashboard, support, simulator]
  );
};

interface ArrangementProps {
  panels: readonly ResolvedDockPanel[];
  running: boolean;
  onOpenSettings: (target: string) => void;
}

const KEEP_MOUNTED_TYPES = new Set(['laptimelog']);

const keepsStateWhileHidden = (resolved: ResolvedDockPanel) =>
  KEEP_MOUNTED_TYPES.has(resolved.panel.type);

const RowArrangement = ({
  panels,
  running,
  onOpenSettings,
}: ArrangementProps) => {
  const { collapsed, toggleCollapsed } = useDockCollapsed();
  const expanded = panels.filter(
    (resolved) => !collapsed.has(resolved.panel.id)
  );
  const expandedKey = expanded.map((resolved) => resolved.panel.id).join(',');
  const [liveWidths, setLiveWidths] = useState<{
    key: string;
    widths: number[];
  } | null>(null);
  const widths = useMemo(
    () =>
      liveWidths?.key === expandedKey
        ? liveWidths.widths
        : readPanelWidths(expandedKey, expanded.length),
    [liveWidths, expandedKey, expanded.length]
  );
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<{
    startWidths: number[];
    latest: number[];
    px: number;
  } | null>(null);

  const applyWidths = useCallback(
    (next: number[], persist: boolean) => {
      setLiveWidths({ key: expandedKey, widths: next });
      if (persist) writePanelWidths(expandedKey, next);
    },
    [expandedKey]
  );

  const handleDragStart = useCallback(() => {
    const px = expanded.reduce(
      (total, resolved) =>
        total +
        (sectionRefs.current.get(resolved.panel.id)?.getBoundingClientRect()
          .width ?? 0),
      0
    );
    dragRef.current = { startWidths: widths, latest: widths, px };
  }, [expanded, widths]);

  const handleDrag = useCallback(
    (index: number, deltaPx: number) => {
      const drag = dragRef.current;
      if (!drag || drag.px <= 0) return;
      drag.latest = moveDivider(
        drag.startWidths,
        index,
        (deltaPx / drag.px) * 100
      );
      applyWidths(drag.latest, false);
    },
    [applyWidths]
  );

  const handleDragEnd = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    writePanelWidths(expandedKey, drag.latest);
  }, [expandedKey]);

  const handleNudge = useCallback(
    (index: number, deltaPercent: number) =>
      applyWidths(moveDivider(widths, index, deltaPercent), true),
    [applyWidths, widths]
  );

  const handleReset = useCallback(
    () => applyWidths(equalWidths(expanded.length), true),
    [applyWidths, expanded.length]
  );

  const content: ReactNode[] = [];
  panels.forEach((resolved, position) => {
    const id = resolved.panel.id;
    const isCollapsed = collapsed.has(id);
    const expandedIndex = expanded.indexOf(resolved);
    if (expandedIndex > 0) {
      const previous = expanded[expandedIndex - 1];
      const dividerIndex = expandedIndex - 1;
      content.push(
        <PanelDivider
          key={`divider:${previous.panel.id}:${id}`}
          index={dividerIndex}
          label={`${dockPanelLabel(previous)} and ${dockPanelLabel(resolved)} split`}
          position={dividerPosition(widths, dividerIndex)}
          min={MIN_PANEL_PERCENT}
          max={100 - MIN_PANEL_PERCENT}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onNudge={handleNudge}
          onReset={handleReset}
        />
      );
    }
    const mountContent = !isCollapsed || keepsStateWhileHidden(resolved);
    content.push(
      <section
        key={id}
        ref={(element) => {
          if (element) sectionRefs.current.set(id, element);
          else sectionRefs.current.delete(id);
        }}
        aria-label={dockPanelLabel(resolved)}
        className={[
          'flex flex-col min-w-0 min-h-0',
          isCollapsed ? 'flex-none' : '',
          isCollapsed && position > 0 ? 'border-l border-slate-700/50' : '',
        ].join(' ')}
        style={
          isCollapsed ? undefined : { flex: `${widths[expandedIndex]} 1 0%` }
        }
      >
        <DockPanelHeader
          panelId={id}
          label={dockPanelLabel(resolved)}
          settingsTarget={dockPanelSettingsTarget(resolved)}
          collapsed={isCollapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenSettings={onOpenSettings}
        />
        {mountContent && (
          <div
            className={isCollapsed ? 'hidden' : 'flex-1 min-h-0 overflow-auto'}
          >
            <DockPanelContent
              resolved={resolved}
              running={running}
              onOpenSettings={onOpenSettings}
            />
          </div>
        )}
      </section>
    );
  });

  return <div className="flex flex-1 min-h-0">{content}</div>;
};

const TabsArrangement = ({
  panels,
  running,
  onOpenSettings,
}: ArrangementProps) => {
  const [activeId, setActiveId] = useState(panels[0]?.panel.id);
  const active =
    panels.find((resolved) => resolved.panel.id === activeId) ?? panels[0];
  if (!active) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        role="tablist"
        aria-label="Docked panels"
        className="flex items-center gap-1 px-2 py-1 bg-slate-800/60 border-b border-slate-700/50 flex-shrink-0"
      >
        {panels.map((resolved) => {
          const selected = resolved === active;
          return (
            <button
              key={resolved.panel.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(resolved.panel.id)}
              className={[
                'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider transition-colors',
                selected
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {dockPanelLabel(resolved)}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          type="button"
          className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
          title={`Open ${dockPanelLabel(active)} settings`}
          aria-label={`Open ${dockPanelLabel(active)} settings`}
          onClick={() => onOpenSettings(dockPanelSettingsTarget(active))}
        >
          <GearIcon size={14} />
        </button>
      </div>
      <div role="tabpanel" className="flex-1 min-h-0 overflow-auto">
        {panels.map((resolved) => {
          const isActive = resolved === active;
          if (!isActive && !keepsStateWhileHidden(resolved)) return null;
          return (
            <div
              key={resolved.panel.id}
              className={isActive ? 'h-full' : 'hidden'}
            >
              <DockPanelContent
                resolved={resolved}
                running={running}
                onOpenSettings={onOpenSettings}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface GantryDockHostProps {
  dock: ResolvedDock;
}

/**
 * Renders overlay widgets docked under the Gantry incident feed. It is a host,
 * like OverlayContainer, not a widget: Gantry only receives what it renders.
 */
export const GantryDockHost = memo(({ dock }: GantryDockHostProps) => {
  const { bridge } = useDashboard();
  const { running } = useRunningState();

  const widgets = useMemo(
    () =>
      dock.panels.flatMap((resolved) =>
        resolved.status === 'ready' ? [resolved.widget] : []
      ),
    [dock]
  );
  const needsSectorTiming = widgets.some((widget) =>
    SECTOR_TIMING_TYPES.has(widget.type || widget.id)
  );

  const openSettings = useCallback(
    (target: string) => void bridge.openWidgetSettings?.(target),
    [bridge]
  );

  const Arrangement =
    dock.arrangement === 'tabs' ? TabsArrangement : RowArrangement;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900">
      {/* Session data comes from GantryApp's own provider. */}
      <RendererDataProviders widgets={widgets} sessionAlreadyMounted />
      {needsSectorTiming && (
        // The map's rates, not the Gantry's, as on the overlay.
        <WidgetRuntimeProvider widgetType="map">
          <SectorTimingUpdater />
        </WidgetRuntimeProvider>
      )}
      <Arrangement
        panels={dock.panels}
        running={running}
        onOpenSettings={openSettings}
      />
    </div>
  );
});
GantryDockHost.displayName = 'GantryDockHost';
