import { memo, useCallback, useMemo, useState } from 'react';
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

const RowArrangement = ({
  panels,
  running,
  onOpenSettings,
}: ArrangementProps) => {
  const { collapsed, toggleCollapsed } = useDockCollapsed();
  return (
    <div className="flex flex-1 min-h-0 divide-x divide-slate-700/50">
      {panels.map((resolved) => {
        const isCollapsed = collapsed.has(resolved.panel.id);
        return (
          <section
            key={resolved.panel.id}
            aria-label={dockPanelLabel(resolved)}
            className={[
              'flex flex-col min-w-0 min-h-0',
              isCollapsed ? 'flex-none' : 'flex-1',
            ].join(' ')}
          >
            <DockPanelHeader
              panelId={resolved.panel.id}
              label={dockPanelLabel(resolved)}
              settingsTarget={dockPanelSettingsTarget(resolved)}
              collapsed={isCollapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenSettings={onOpenSettings}
            />
            {!isCollapsed && (
              <div className="flex-1 min-h-0 overflow-auto">
                <DockPanelContent
                  resolved={resolved}
                  running={running}
                  onOpenSettings={onOpenSettings}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
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
        <DockPanelContent
          key={active.panel.id}
          resolved={active}
          running={running}
          onOpenSettings={onOpenSettings}
        />
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
