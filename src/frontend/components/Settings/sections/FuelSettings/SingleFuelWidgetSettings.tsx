import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseSettingsSection } from '../../components/BaseSettingsSection';
import {
  FuelWidgetSettings,
  LayoutNode,
  SettingsTabType,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { PlusIcon } from '@phosphor-icons/react';
import { SessionVisibility } from '../../components/SessionVisibility';
import { TabButton } from '../../components/TabButton';
import { LayoutVisualizer, migrateToTree } from '../LayoutVisualizer';
import { DEFAULT_FUEL_LAYOUT_TREE } from '../../../FuelCalculator/defaults';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { GridOrderSettingsList } from './GridOrderSettingsList';
import { AVAILABLE_WIDGETS_FUEL, generateId } from './utils';
import { FuelStatusAlertsSection } from './FuelStatusAlertsSection';
import { FuelHistorySection } from './FuelHistorySection';
import { PitStrategySection } from './PitStrategySection';
import { HistoricalStorageSection } from './HistoricalStorageSection';
import { SettingDivider } from '../../components/SettingDivider';
import { SettingsSection } from '../../components/SettingSection';
import { deleteFuelLayout } from '../gantryDockEdits';
import { SettingProps, settingPropFor } from '../../components/SettingProp';

const SettingProp = settingPropFor('fuel');

const defaultConfig = getWidgetDefaultConfig('fuel');
const DEFAULT_TREE_FUEL = DEFAULT_FUEL_LAYOUT_TREE;

export const SingleFuelWidgetSettings = ({
  widgetId,
}: {
  widgetId: string;
}) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();

  const fuelWidgets =
    currentDashboard?.widgets.filter((w) => (w.type || w.id) === 'fuel') ?? [];

  const [selectedId, setSelectedId] = useState(widgetId);
  const [prevWidgetId, setPrevWidgetId] = useState(widgetId);

  if (widgetId !== prevWidgetId) {
    setPrevWidgetId(widgetId);
    setSelectedId(widgetId);
  }

  const handleWidgetChange = (newId: string) => {
    setSelectedId(newId);
    navigate(`/settings/${newId}`);
  };

  const handleAddWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;
    const newId = `fuel-${generateId()}`;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: [
        ...currentDashboard.widgets,
        {
          id: newId,
          type: 'fuel',
          enabled: true,
          layout: { x: 50, y: 50, width: 300, height: 220 },
          config: defaultConfig as unknown as Record<string, unknown>,
        },
      ],
    });
    handleWidgetChange(newId);
  };

  const handleDeleteWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;
    const updated = deleteFuelLayout(currentDashboard, selectedId);
    onDashboardUpdated(updated);
    const remaining = updated.widgets.filter(
      (w) => (w.type || w.id) === 'fuel'
    );
    if (remaining.length > 0) handleWidgetChange(remaining[0].id);
    else navigate('/settings/fuel');
  };

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as FuelWidgetSettings | undefined;
  const isGantryOnly =
    currentDashboard?.widgets.find((w) => w.id === widgetId)?.placement ===
    'gantry';

  const [settings, setSettings] = useState<FuelWidgetSettings>(() => {
    const savedConfig =
      (savedSettings?.config as FuelWidgetSettings['config']) ?? defaultConfig;
    const needsDefaultTree =
      (!savedConfig.layoutConfig || savedConfig.layoutConfig.length === 0) &&
      !savedConfig.layoutTree;
    return {
      enabled: savedSettings?.enabled ?? false,
      config: needsDefaultTree
        ? { ...savedConfig, layoutTree: DEFAULT_TREE_FUEL }
        : savedConfig,
    };
  });

  const availableWidgets = AVAILABLE_WIDGETS_FUEL;

  // Calculate tree state from settings (migrating if needed)
  const currentTree = useMemo(() => {
    // Validate that the tree has a type before using it
    if (settings.config.layoutTree && settings.config.layoutTree.type)
      return settings.config.layoutTree;
    // Auto-migrate legacy list to tree for the visualizer
    return migrateToTree(settings.config.layoutConfig || []);
  }, [settings.config.layoutTree, settings.config.layoutConfig]);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('fuelWidgetTab') as SettingsTabType) || 'layout'
  );

  useEffect(() => {
    localStorage.setItem('fuelWidgetTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard || !savedSettings) {
    return (
      <div className="p-4 text-slate-400">Widget not found or loading...</div>
    );
  }

  return (
    <BaseSettingsSection
      title="Fuel Calculator"
      description={`Configure the Fuel Calculator layout. Editing: ${widgetId}${isGantryOnly ? ' (Gantry)' : ''}.`}
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={widgetId}
      disableInternalScroll={true}
      hidePositionReset={isGantryOnly || activeTab === 'history'}
    >
      {(handleConfigChange) => {
        const handleTreeUpdate = (newTree: LayoutNode) => {
          handleConfigChange({ layoutTree: newTree });
        };

        return (
          <SettingProps
            widget="fuel"
            config={settings.config}
            onChange={handleConfigChange}
          >
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
                <TabButton
                  id="layout"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Layout
                </TabButton>
                <TabButton
                  id="display"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Display
                </TabButton>
                <TabButton
                  id="options"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Options
                </TabButton>
                <TabButton
                  id="history"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  History
                </TabButton>
                <TabButton
                  id="visibility"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Visibility
                </TabButton>
              </div>

              <div>
                {/* LAYOUT TAB */}
                {activeTab === 'layout' && (
                  <>
                    {/* Top Manager Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-slate-200">
                          Editing Widget:
                        </span>
                        <select
                          aria-label="Editing fuel widget"
                          value={selectedId}
                          onChange={(e) => handleWidgetChange(e.target.value)}
                          className="settings-field"
                        >
                          {fuelWidgets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.placement === 'gantry'
                                ? `${w.id} (Gantry)`
                                : w.id}
                            </option>
                          ))}
                        </select>
                        {isGantryOnly && (
                          <span
                            className="px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            title="Only shown docked in the Gantry, never on the overlay."
                          >
                            Gantry
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeleteWidget}
                          disabled={selectedId === 'fuel'}
                          title={
                            selectedId === 'fuel'
                              ? 'Default widget cannot be deleted. Disable it instead.'
                              : 'Delete this layout configuration'
                          }
                          className={`settings-button-danger ${
                            selectedId === 'fuel'
                              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                              : ''
                          }`}
                        >
                          {selectedId === 'fuel'
                            ? 'Default (Locked)'
                            : 'Delete Layout'}
                        </button>
                        <button
                          onClick={handleAddWidget}
                          className="settings-button-primary"
                        >
                          <PlusIcon /> New Layout
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-slate-200">
                          Layout Editor
                        </h3>
                        <span className="text-xs text-slate-500">
                          Drag to Split (Right/Bottom)
                        </span>
                      </div>

                      {currentTree && (
                        <LayoutVisualizer
                          tree={currentTree}
                          onChange={handleTreeUpdate}
                          availableWidgets={availableWidgets}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* DISPLAY TAB */}
                {activeTab === 'display' && (
                  <div className="space-y-5">
                    <SettingsSection title="Display" scaleWidgetId={widgetId}>
                      <SettingProp path="useGeneralCompactMode" />

                      {/* Background Opacity */}
                      <SettingProp path="background.opacity" />
                    </SettingsSection>
                  </div>
                )}

                {/* OPTIONS TAB */}
                {activeTab === 'options' && (
                  <div className="space-y-8">
                    <SettingsSection title="Options">
                      {/* Fuel Units */}
                      <SettingProp path="fuelUnits" />

                      {/* Safety Margin */}
                      <SettingProp path="safetyMargin" />
                    </SettingsSection>

                    {/* Fuel Status Alerts */}
                    <FuelStatusAlertsSection
                      settings={settings}
                      onChange={handleConfigChange}
                    />

                    {/* Consumption Details Section */}
                    <SettingsSection title="Fuel Consumption">
                      {/* Fuel 2 Grid Reordering */}
                      <GridOrderSettingsList
                        itemsOrder={
                          settings.config.consumptionGridOrder ||
                          defaultConfig.consumptionGridOrder ||
                          []
                        }
                        onReorder={(newOrder) =>
                          handleConfigChange({ consumptionGridOrder: newOrder })
                        }
                        settings={settings}
                        handleConfigChange={handleConfigChange}
                      />
                    </SettingsSection>

                    {/* Fuel History */}
                    <FuelHistorySection
                      settings={settings}
                      onChange={handleConfigChange}
                    />

                    {/* Pit Strategy Section */}
                    <PitStrategySection
                      settings={settings}
                      onChange={handleConfigChange}
                    />
                  </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                  <>
                    {/* Historical Storage Section */}
                    <HistoricalStorageSection />
                  </>
                )}

                {/* VISIBILITY TAB */}
                {activeTab === 'visibility' && (
                  <SettingsSection title="Session Visibility">
                    <SessionVisibility
                      sessionVisibility={settings.config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />

                    {!isGantryOnly && (
                      <>
                        <SettingDivider />

                        <SettingProp path="showOnlyWhenOnTrack" />
                      </>
                    )}
                  </SettingsSection>
                )}
              </div>
            </div>
          </SettingProps>
        );
      }}
    </BaseSettingsSection>
  );
};
