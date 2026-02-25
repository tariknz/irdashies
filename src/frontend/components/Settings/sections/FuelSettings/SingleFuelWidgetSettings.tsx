import { useState, useMemo, useEffect } from 'react';
import { BaseSettingsSection } from '../../components/BaseSettingsSection';
import { FuelWidgetSettings, LayoutNode, SettingsTabType, TabButtonProps } from '../../types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../../components/SessionVisibility';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { LayoutVisualizer, migrateToTree } from '../LayoutVisualizer';
import { DEFAULT_FUEL_LAYOUT_TREE, defaultFuelCalculatorSettings } from '../../../FuelCalculator/defaults';
import { DualFontSizeInput } from './FontSizeInputs';
import { GridOrderSettingsList } from './GridOrderSettingsList';
import { migrateConfig, AVAILABLE_WIDGETS_FUEL } from './utils';
import { WidgetFontSizeSettings } from './WidgetFontSizeSettings';
import { FuelStatusAlertsSection } from './FuelStatusAlertsSection';
import { FuelHistorySection } from './FuelHistorySection';
import { PitStrategySection } from './PitStrategySection';
import { HistoricalStorageSection } from './HistoricalStorageSection';

const defaultConfig = defaultFuelCalculatorSettings;
const DEFAULT_TREE_FUEL = DEFAULT_FUEL_LAYOUT_TREE;

export const SingleFuelWidgetSettings = ({ widgetId }: { widgetId: string }) => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as FuelWidgetSettings | undefined;

  const [settings, setSettings] = useState<FuelWidgetSettings>(() => {
    const initialConfig = migrateConfig(savedSettings?.config);

    // Use DEFAULT_TREE_FUEL if no layout is defined
    if ((!initialConfig.layoutConfig || initialConfig.layoutConfig.length === 0) && !initialConfig.layoutTree) {
      initialConfig.layoutTree = DEFAULT_TREE_FUEL;
    }
    return {
      enabled: savedSettings?.enabled ?? false,
      config: initialConfig,
    };
  });

  const availableWidgets = AVAILABLE_WIDGETS_FUEL;

  // Calculate tree state from settings (migrating if needed)
  const currentTree = useMemo(() => {
    // Validate that the tree has a type before using it
    if (settings.config.layoutTree && settings.config.layoutTree.type) return settings.config.layoutTree;
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
    return <div className="p-4 text-slate-400">Widget not found or loading...</div>;
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
                id="options"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Options
              </TabButton>
              <TabButton
                id="fuel"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Fuel
              </TabButton>
              <TabButton
                id="pit"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Pit
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

            <div className="pt-4">
              {/* LAYOUT TAB */}
              {activeTab === 'layout' && (
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
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <div className="space-y-4">
                  {/* General Control Toggles */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-slate-200">
                      Options
                    </h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-300">
                        Use General font Sizes
                      </span>
                      <span className="block text-xs text-slate-500">
                        Syncs with Font Size slider in General tab
                      </span>
                    </div>
                    <ToggleSwitch
                      enabled={settings.config.useGeneralFontSize ?? false}
                      onToggle={(val) =>
                        handleConfigChange({ useGeneralFontSize: val })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-300">
                        Use General Compact Mode
                      </span>
                      <span className="block text-xs text-slate-500">
                        Syncs with Compact Mode in General tab
                      </span>
                    </div>
                    <ToggleSwitch
                      enabled={settings.config.useGeneralCompactMode ?? false}
                      onToggle={(val) =>
                        handleConfigChange({ useGeneralCompactMode: val })
                      }
                    />
                  </div>

                  {/* Background Opacity */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Background Opacity
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.config.background.opacity}
                        onChange={(e) =>
                          handleConfigChange({
                            background: { opacity: parseInt(e.target.value) },
                          })
                        }
                        className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <span className="text-xs text-slate-300 w-8">
                        {settings.config.background.opacity}%
                      </span>
                    </div>
                  </div>

                  {/* Widget Font Size Settings */}
                  <WidgetFontSizeSettings
                    settings={settings}
                    onChange={handleConfigChange}
                  />
                </div>
              )}

              {/* FUEL TAB */}
              {activeTab === 'fuel' && (
                <div className="space-y-4">
                  {/* Fuel Status Alerts */}
                  <FuelStatusAlertsSection
                    settings={settings}
                    onChange={handleConfigChange}
                  />

                  {/* Fuel Units */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Fuel Units</span>
                    <select
                      value={settings.config.fuelUnits}
                      onChange={(e) =>
                        handleConfigChange({
                          fuelUnits: e.target.value as 'L' | 'gal',
                        })
                      }
                      className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm"
                    >
                      <option value="L">Liters (L)</option>
                      <option value="gal">Gallons (gal)</option>
                    </select>
                  </div>

                  {/* Consumption Details Section */}
                  <div className="py-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">
                        Consumption Details
                        <span className="block text-xs text-slate-500">
                          Configures rows in Consumption Grid
                        </span>
                      </span>
                      <div className="flex items-center gap-4">
                        <DualFontSizeInput
                          widgetId="fuelGrid"
                          settings={settings}
                          onChange={handleConfigChange}
                        />
                      </div>
                    </div>

                    {/* Fuel 2 Grid Reordering */}
                    <div className="pl-2 pr-1">
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
                    </div>
                  </div>

                  {/* Economy Predict */}
                  <div className="flex items-center justify-between py-4 border-b border-white/5">
                    <div>
                      <span className="text-sm text-slate-300">
                        Economy Predict
                      </span>
                      <span className="block text-xs text-slate-500">
                        Predicts fuel usage vs target. Adjust Label/Value sizes.
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <DualFontSizeInput
                        widgetId="fuelEconomyPredict"
                        settings={settings}
                        onChange={handleConfigChange}
                      />
                    </div>
                  </div>

                  {/* Fuel History */}
                  <FuelHistorySection
                    settings={settings}
                    onChange={handleConfigChange}
                  />

                  {/* Safety Margin */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Safety Margin
                      <span className="block text-xs text-slate-500">
                        Extra fuel added to &quot;To Finish&quot; calculation.
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.1"
                        value={settings.config.safetyMargin}
                        onChange={(e) =>
                          handleConfigChange({
                            safetyMargin:
                              parseFloat(e.target.value.replace(',', '.')) || 0,
                          })
                        }
                        className="w-16 px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs text-right focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-300 w-8">
                        {settings.config.fuelUnits}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* PIT TAB */}
              {activeTab === 'pit' && (
                <div className="space-y-4">
                  {/* Pit Strategy Section */}
                  <PitStrategySection
                    settings={settings}
                    onChange={handleConfigChange}
                  />
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {/* Historical Storage Section */}
                  <HistoricalStorageSection
                    settings={settings}
                    onChange={handleConfigChange}
                  />
                </div>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <div className="space-y-4">
                  {/* Session Visibility Settings */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-slate-200">
                      Session Visibility
                    </h3>
                  </div>
                  <div className="space-y-3 pl-4">
                    <SessionVisibility
                      sessionVisibility={settings.config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />

                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <div>
                        <h4 className="text-md font-medium text-slate-300">
                          Show only when on track
                        </h4>
                        <span className="block text-xs text-slate-500">
                          If enabled, calculator will only be shown when you are
                          driving.
                        </span>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.showOnlyWhenOnTrack}
                        onToggle={(newValue) =>
                          handleConfigChange({
                            showOnlyWhenOnTrack: newValue,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};

const TabButton = ({ id, activeTab, setActiveTab, children }: TabButtonProps) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`px-4 py-2 text-sm border-b-2 transition-colors ${
      activeTab === id
        ? 'text-white border-blue-500'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    {children}
  </button>
);