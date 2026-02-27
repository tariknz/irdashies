import { useState, useMemo, useEffect } from 'react';
import { BaseSettingsSection } from '../../components/BaseSettingsSection';
import { FuelWidgetSettings, LayoutNode, SettingsTabType } from '../../types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../../components/SessionVisibility';
import { TabButton } from '../../components/TabButton';
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
import { SettingDivider } from '../../components/SettingDivider';
import { SettingsSection } from '../../components/SettingSection';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import { SettingSliderRow } from '../../components/SettingSliderRow';
import { SettingSelectRow } from '../../components/SettingSelectRow';
import { SettingNumberRow } from '../../components/SettingNumberRow';

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

            <div className="pt-4 space-y-4">
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

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (           
                <>
                <SettingsSection title="Display">

                  {/* General Control Toggles */}
                  <SettingToggleRow
                    title="Use General font Sizes"
                    description="Syncs with Font Size slider in General tab"
                    enabled={settings.config.useGeneralFontSize ?? false}
                    onToggle={(enabled) =>
                      handleConfigChange({ useGeneralFontSize: enabled })
                    }
                  />

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
                <SettingsSection title="Widget Settings">
                
                  <WidgetFontSizeSettings settings={settings} onChange={handleConfigChange} />

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
   
                  {/* Moved Fuel Scenarios here for better organization */}
                  <DualFontSizeInput 
                    widgetId="Fuel Scenarios" 
                    title="Consumption Details" 
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
                    onChange={(v) =>
                      handleConfigChange({ fuelUnits: v })
                    }
                  />        

                  {/* Safety Margin */}
                  <SettingNumberRow
                    title="Safety Margin"
                    description="Extra fuel added to &quot;To Finish&quot; calculation."
                    value={settings.config.safetyMargin}
                    min={0}
                    max={50}
                    step={0.1}
                    onChange={(v) => handleConfigChange({ safetyMargin: v })}
                  />
                  
                </SettingsSection>

                {/* Fuel Status Alerts */}
                <FuelStatusAlertsSection settings={settings} onChange={handleConfigChange} />

                {/* Consumption Details Section */}
                <SettingsSection title="Fuel Consumption">  
                  {/* Fuel 2 Grid Reordering */}
                  <GridOrderSettingsList
                    itemsOrder={settings.config.consumptionGridOrder || defaultConfig.consumptionGridOrder || []}
                    onReorder={(newOrder) => handleConfigChange({ consumptionGridOrder: newOrder })}
                    settings={settings}
                    handleConfigChange={handleConfigChange}
                  />
                </SettingsSection>

                {/* Fuel History */}
                <FuelHistorySection settings={settings} onChange={handleConfigChange} />                  

                {/* Pit Strategy Section */}
                <PitStrategySection settings={settings} onChange={handleConfigChange} />

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