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
import { DualFontSizeInput } from './FontSizeInputs';
import { GridOrderSettingsList } from './GridOrderSettingsList';
import { AVAILABLE_WIDGETS_FUEL, generateId } from './utils';
import { WidgetFontSizeSettings } from './WidgetFontSizeSettings';
import { FuelStatusAlertsSection } from './FuelStatusAlertsSection';
import { FuelHistorySection } from './FuelHistorySection';
import { PitStrategySection } from './PitStrategySection';
import { HistoricalStorageSection } from './HistoricalStorageSection';
import { SettingDivider } from '../../components/SettingDivider';
import { SettingsSection } from '../../components/SettingSection';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import { SettingSliderRow } from '../../components/SettingSliderRow';
import { SettingSelectRow } from '../../components/SettingSelectRow';
import { SettingNumberRow } from '../../components/SettingNumberRow';

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
    const newWidgets = currentDashboard.widgets.filter(
      (w) => w.id !== selectedId
    );
    onDashboardUpdated({ ...currentDashboard, widgets: newWidgets });
    const remaining = newWidgets.filter((w) => (w.type || w.id) === 'fuel');
    if (remaining.length > 0) handleWidgetChange(remaining[0].id);
    else navigate('/settings/fuel');
  };

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as FuelWidgetSettings | undefined;

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
      title={`Fuel Calculator Settings - ${widgetId}`}
      description="Configure the Fuel Calculator layout."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={widgetId}
      disableInternalScroll={true}
    >
      {(handleConfigChange) => {
        const handleTreeUpdate = (newTree: LayoutNode) => {
          handleConfigChange({ layoutTree: newTree });
        };

        return (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
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
                  <div className="bg-slate-800 p-3 rounded flex items-center justify-between border border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-200">
                        Editing Widget:
                      </span>
                      <select
                        value={selectedId}
                        onChange={(e) => handleWidgetChange(e.target.value)}
                        className="bg-slate-900 border border-slate-600 text-white text-sm rounded px-2 py-1"
                      >
                        {fuelWidgets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id}
                          </option>
                        ))}
                      </select>
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
                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                          selectedId === 'fuel'
                            ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                            : 'bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800'
                        }`}
                      >
                        {selectedId === 'fuel'
                          ? 'Default (Locked)'
                          : 'Delete Layout'}
                      </button>
                      <button
                        onClick={handleAddWidget}
                        className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
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
                <>
                  <SettingsSection title="Display">
                    <SettingToggleRow
                      title="Use General Compact Mode"
                      description="Syncs with Compact Mode in General tab"
                      enabled={settings.config.useGeneralCompactMode ?? false}
                      onToggle={(enabled) =>
                        handleConfigChange({ useGeneralCompactMode: enabled })
                      }
                    />

                    {/* Background Opacity */}
                    <SettingSliderRow
                      title="Background Opacity"
                      value={settings.config.background.opacity ?? 40}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ background: { opacity: v } })
                      }
                    />
                  </SettingsSection>

                  {/* Widget Font Size Settings */}
                  <SettingsSection title="Font Sizes">
                    {/* General Control Toggles */}
                    <SettingToggleRow
                      title="Use General font Sizes"
                      description="Syncs with Font Size slider in General tab"
                      enabled={settings.config.useGeneralFontSize ?? false}
                      onToggle={(enabled) =>
                        handleConfigChange({ useGeneralFontSize: enabled })
                      }
                    />

                    {!settings.config.useGeneralFontSize && (
                      <>
                        <WidgetFontSizeSettings
                          settings={settings}
                          onChange={handleConfigChange}
                        />

                        {/* Consumption Details Section */}
                        <DualFontSizeInput
                          widgetId="fuelGrid"
                          title="Consumption Details"
                          description="Configures rows in Consumption Grid."
                          settings={settings}
                          onChange={handleConfigChange}
                        />

                        {/* Economy Predict */}
                        <DualFontSizeInput
                          widgetId="fuelEconomyPredict"
                          title="Economy Predict"
                          description="Predicts fuel usage vs target. Adjust Label/Value sizes."
                          settings={settings}
                          onChange={handleConfigChange}
                        />

                        {/* Fuel History */}
                        <DualFontSizeInput
                          widgetId="fuelGraph"
                          title="Fuel History"
                          description="Used for Fuel History - see options."
                          settings={settings}
                          onChange={handleConfigChange}
                        />

                        {/* Fuel Scenarios */}
                        <DualFontSizeInput
                          widgetId="fuelScenarios"
                          title="Fuel Scenarios"
                          description="Pit stop calculations (-1, Ideal, +1 Lap)."
                          settings={settings}
                          onChange={handleConfigChange}
                        />

                        {/* Target Message Font */}
                        <DualFontSizeInput
                          widgetId="fuelTargetMessage"
                          title="Target Message Font"
                          description="Used for Pit Strategy - see options."
                          settings={settings}
                          onChange={handleConfigChange}
                        />
                      </>
                    )}
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Options">
                    {/* Fuel Units */}
                    <SettingSelectRow<'L' | 'gal'>
                      title="Fuel Units"
                      description="Show fuel in litres or gallons."
                      value={settings.config.fuelUnits}
                      options={[
                        { label: 'Litres (L)', value: 'L' },
                        { label: 'Gallons (gal)', value: 'gal' },
                      ]}
                      onChange={(v) => handleConfigChange({ fuelUnits: v })}
                    />

                    {/* Safety Margin */}
                    <SettingNumberRow
                      title="Safety Margin"
                      description='Extra fuel added to "To Finish" calculation.'
                      value={settings.config.safetyMargin}
                      min={0}
                      max={50}
                      step={0.1}
                      onChange={(v) => handleConfigChange({ safetyMargin: v })}
                    />
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
                </>
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <>
                  {/* Historical Storage Section */}
                  <HistoricalStorageSection
                    settings={settings}
                    onChange={handleConfigChange}
                  />
                </>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingDivider />

                  <SettingToggleRow
                    title="Show only when on track"
                    description="If enabled, fuel will only be shown when driving"
                    enabled={settings.config.showOnlyWhenOnTrack ?? false}
                    onToggle={(newValue) =>
                      handleConfigChange({ showOnlyWhenOnTrack: newValue })
                    }
                  />
                </SettingsSection>
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
