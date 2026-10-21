import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';
import {
  GANTRY_DOCK_MAX_PANELS,
  GANTRY_DOCK_PANEL_LABELS,
  GANTRY_DOCK_WIDGET_TYPES,
  resolveDockPanels,
  type DashboardLayout,
  type DashboardWidget,
  type GantryDockConfig,
  type GantryDockPanel,
  type GantryDockWidgetType,
  type ResolvedDockPanel,
} from '@irdashies/types';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import {
  createGantryFuelLayout,
  newDockPanelId,
  newGantryFuelId,
  readGantryDock,
  removeDockPanel,
  withGantryDock,
} from './gantryDockEdits';

const NO_SOURCE = '';

const isFuel = (widget: DashboardWidget) =>
  (widget.type || widget.id) === 'fuel';

const sourceLabel = (widget: DashboardWidget) =>
  widget.placement === 'gantry'
    ? `Gantry-only layout: ${widget.id}`
    : `Use overlay: ${widget.id === 'fuel' ? 'Fuel Calculator' : widget.id}`;

/** A panel that shows a single-instance widget can only appear once. */
const isTypeTaken = (
  type: GantryDockWidgetType,
  panels: readonly GantryDockPanel[],
  exceptId?: string
) =>
  type !== 'fuel' &&
  panels.some((panel) => panel.type === type && panel.id !== exceptId);

const selectClass =
  'bg-slate-700 text-white text-sm rounded-md px-2 py-1 disabled:opacity-50';
const smallButtonClass =
  'flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors';

interface PanelRowProps {
  resolved: ResolvedDockPanel;
  panels: readonly GantryDockPanel[];
  fuelWidgets: readonly DashboardWidget[];
  onTypeChange: (panelId: string, type: GantryDockWidgetType) => void;
  onSourceChange: (panelId: string, widgetId: string | undefined) => void;
  onCreateGantryFuel: (panelId: string) => void;
  onRemove: (panelId: string, deleteLayout: boolean) => void;
  onEdit: (settingsPath: string) => void;
}

const PanelRowControls = ({
  resolved,
  panels,
  fuelWidgets,
  onTypeChange,
  onSourceChange,
  onCreateGantryFuel,
  onRemove,
  onEdit,
}: PanelRowProps) => {
  const { panel } = resolved;
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const linked = resolved.status === 'ready' ? resolved.widget : undefined;
  const usesGantryLayout = linked?.placement === 'gantry';
  const usedElsewhere = new Set(
    panels.filter((p) => p.id !== panel.id).map((p) => p.widgetId)
  );

  const handleRemove = () => {
    if (usesGantryLayout) setConfirmingRemove(true);
    else onRemove(panel.id, false);
  };

  return (
    <div className="mt-2 ml-7 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Panel type"
          className={selectClass}
          value={panel.type}
          onChange={(e) =>
            onTypeChange(panel.id, e.target.value as GantryDockWidgetType)
          }
        >
          {GANTRY_DOCK_WIDGET_TYPES.map((type) => (
            <option
              key={type}
              value={type}
              disabled={isTypeTaken(type, panels, panel.id)}
            >
              {GANTRY_DOCK_PANEL_LABELS[type]}
            </option>
          ))}
        </select>

        {panel.type === 'fuel' && (
          <select
            aria-label="Source"
            className={selectClass}
            value={panel.widgetId ?? NO_SOURCE}
            onChange={(e) =>
              onSourceChange(panel.id, e.target.value || undefined)
            }
          >
            {!panel.widgetId && (
              <option value={NO_SOURCE}>Choose a fuel layout</option>
            )}
            {resolved.status === 'removed' && (
              <option value={panel.widgetId} disabled>
                Removed layout: {panel.widgetId}
              </option>
            )}
            {fuelWidgets.map((widget) => (
              <option
                key={widget.id}
                value={widget.id}
                disabled={usedElsewhere.has(widget.id)}
              >
                {sourceLabel(widget)}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove panel"
          title="Remove panel"
          className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-slate-600"
        >
          <TrashIcon size={16} />
        </button>
      </div>

      {panel.type === 'fuel' ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateGantryFuel(panel.id)}
            className={`${smallButtonClass} bg-green-800/60 hover:bg-green-700 text-green-100 border-green-700`}
          >
            <PlusIcon size={12} /> Create Gantry fuel layout
          </button>
          {linked && (
            <button
              type="button"
              onClick={() => onEdit(`/settings/${linked.id}`)}
              className={`${smallButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600`}
            >
              Edit fuel layout
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Uses the {GANTRY_DOCK_PANEL_LABELS[panel.type]} settings.</span>
          <button
            type="button"
            onClick={() => onEdit(`/settings/${panel.type}`)}
            className="text-accent-400 hover:text-accent-300 underline"
          >
            Edit {GANTRY_DOCK_PANEL_LABELS[panel.type]} settings
          </button>
        </div>
      )}

      {resolved.status === 'removed' && (
        <p className="flex items-center gap-1 text-xs text-amber-300">
          <WarningIcon size={14} />
          {panel.type === 'fuel'
            ? 'The fuel layout this panel used was removed. Choose another.'
            : `The ${GANTRY_DOCK_PANEL_LABELS[panel.type]} widget is missing from this profile.`}
        </p>
      )}

      {confirmingRemove && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded bg-slate-800 border border-slate-600 text-xs text-slate-300">
          <span className="flex-1">
            This panel uses a Gantry-only fuel layout. Delete the layout too?
          </span>
          <button
            type="button"
            onClick={() => onRemove(panel.id, true)}
            className={`${smallButtonClass} bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800`}
          >
            Delete layout
          </button>
          <button
            type="button"
            onClick={() => onRemove(panel.id, false)}
            className={`${smallButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600`}
          >
            Keep layout
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

/** Settings > Gantry > Docked Panels. */
export const GantryDockSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();
  if (!currentDashboard) return null;

  const dock = readGantryDock(currentDashboard);
  // The editor lists every panel, so resolve as if the dock were on.
  const resolved = resolveDockPanels(
    withGantryDock(currentDashboard, (current) => ({
      ...current,
      enabled: true,
    }))
  ).panels;
  const fuelWidgets = currentDashboard.widgets.filter(isFuel);

  const commit = (next: DashboardLayout) => onDashboardUpdated?.(next);
  const updateDock = (
    update: (current: GantryDockConfig) => GantryDockConfig
  ) => commit(withGantryDock(currentDashboard, update));
  const updatePanel = (
    panelId: string,
    update: (panel: GantryDockPanel) => GantryDockPanel
  ) =>
    updateDock((current) => ({
      ...current,
      panels: current.panels.map((p) => (p.id === panelId ? update(p) : p)),
    }));

  const addPanel = (type: GantryDockWidgetType) =>
    updateDock((current) => ({
      ...current,
      panels: [...current.panels, { id: newDockPanelId(), type }],
    }));

  const createGantryFuel = (panelId: string) => {
    const widgetId = newGantryFuelId();
    commit(createGantryFuelLayout(currentDashboard, panelId, widgetId));
    navigate(`/settings/${widgetId}`);
  };

  const full = dock.panels.length >= GANTRY_DOCK_MAX_PANELS;

  return (
    <SettingsSection title="Docked Panels">
      <SettingToggleRow
        title="Show docked panels below the incident feed"
        description="Shows overlay widgets such as the fuel calculator and track map under the incident feed on the Standings & Incidents tab. Drag the divider in the Gantry to resize them."
        enabled={dock.enabled}
        onToggle={(enabled) =>
          updateDock((current) => ({ ...current, enabled }))
        }
      />

      <SettingButtonGroupRow<GantryDockConfig['arrangement']>
        title="Arrangement"
        description="Side by side shows every panel at once. Tabs shows one at a time, which suits a narrow window."
        value={dock.arrangement}
        options={[
          { label: 'Side by side', value: 'row' },
          { label: 'Tabs', value: 'tabs' },
        ]}
        onChange={(arrangement) =>
          updateDock((current) => ({ ...current, arrangement }))
        }
      />

      <SettingDivider />

      <div>
        <h4 className="text-md font-medium text-slate-300">Panels</h4>
        <p className="text-sm text-slate-500 mt-1">
          Drag to reorder. Up to {GANTRY_DOCK_MAX_PANELS} panels. A fuel panel
          can show one of your overlay fuel layouts, or a Gantry-only layout
          that never appears on the overlay. Track maps use their own settings.
        </p>
      </div>

      {resolved.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No panels yet.</p>
      ) : (
        <SortableList
          items={resolved.map((r) => ({ id: r.panel.id, resolved: r }))}
          onReorder={(items) =>
            updateDock((current) => ({
              ...current,
              panels: items.map((item) => item.resolved.panel),
            }))
          }
          renderItem={({ resolved: row }, sortableProps) => (
            <DraggableSettingItem
              key={row.panel.id}
              label={GANTRY_DOCK_PANEL_LABELS[row.panel.type]}
              enabled
              onToggle={() => undefined}
              showToggle={false}
              sortableProps={sortableProps}
            >
              <PanelRowControls
                resolved={row}
                panels={dock.panels}
                fuelWidgets={fuelWidgets}
                onTypeChange={(panelId, type) =>
                  updatePanel(panelId, (p) => ({ id: p.id, type }))
                }
                onSourceChange={(panelId, widgetId) =>
                  updatePanel(panelId, (p) => ({ ...p, widgetId }))
                }
                onCreateGantryFuel={createGantryFuel}
                onRemove={(panelId, deleteLayout) =>
                  commit(
                    removeDockPanel(currentDashboard, panelId, deleteLayout)
                  )
                }
                onEdit={(path) => navigate(path)}
              />
            </DraggableSettingItem>
          )}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {GANTRY_DOCK_WIDGET_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={full || isTypeTaken(type, dock.panels)}
            onClick={() => addPanel(type)}
            className={`${smallButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <PlusIcon size={12} /> Add {GANTRY_DOCK_PANEL_LABELS[type]}
          </button>
        ))}
      </div>
    </SettingsSection>
  );
};
