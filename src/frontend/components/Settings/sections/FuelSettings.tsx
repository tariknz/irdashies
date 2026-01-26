import { useState, useMemo } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FuelWidgetSettings, SessionVisibilitySettings, BoxConfig, FuelWidgetType, LayoutNode } from '../types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { PlusIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { LayoutVisualizer, migrateToTree } from './LayoutVisualizer';
import { useSortableList } from '../../SortableList';

const generateId = () => Math.random().toString(36).substring(2, 9);

const defaultConfig: FuelWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  fuelUnits: 'L',
  layout: 'vertical',
  showConsumption: true,
  showFuelLevel: true,
  showLapsRemaining: true,
  showMin: true,
  showCurrentLap: true,
  showLastLap: true,
  show3LapAvg: true,
  show10LapAvg: true,
  showMax: true,
  showPitWindow: true,
  showEnduranceStrategy: true,
  showFuelScenarios: true,
  showFuelRequired: true,
  showFuelHistory: true,
  fuelHistoryType: 'histogram',
  safetyMargin: 0.05,
  background: { opacity: 85 },
  fuelRequiredMode: 'toFinish',
  enableTargetPitLap: false,
  targetPitLap: 15,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
  layoutConfig: [], // Default empty
  layoutTree: undefined, // Will be migrated on load
  consumptionGridOrder: ['curr', 'avg', 'max', 'last', 'min'],
  avgLapsCount: 3,
  fuelStatusThresholds: { green: 60, amber: 30, red: 10 },
  fuelStatusBasis: 'avg',
  fuelStatusRedLaps: 3,
  widgetStyles: {
    'fuel2Graph': { height: 64, labelFontSize: 10, valueFontSize: 12, barFontSize: 8 },
    'fuel2Header': { labelFontSize: 10, valueFontSize: 14 },
    'fuel2Confidence': { labelFontSize: 10, valueFontSize: 12 },
    'fuel2Gauge': { labelFontSize: 10, valueFontSize: 12 },
    'fuel2TimeEmpty': { labelFontSize: 10, valueFontSize: 14 },
    'fuel2Grid': { labelFontSize: 10, valueFontSize: 12 },
    'fuel2Scenarios': { labelFontSize: 10, valueFontSize: 12 },
    'fuel2TargetMessage': { labelFontSize: 10, valueFontSize: 12 },
  }
};

const migrateConfig = (savedConfig: unknown): FuelWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    ...defaultConfig,
    ...config,
    // Ensure deep merge for nested objects if needed, but simple spread usually enough for flat flags
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
    layoutConfig: (config.layoutConfig as BoxConfig[]) ?? [],
    layoutTree: (config.layoutTree && (config.layoutTree as any).type ? (config.layoutTree as LayoutNode) : undefined),
    consumptionGridOrder: (config.consumptionGridOrder as string[]) ?? defaultConfig.consumptionGridOrder,
    enableTargetPitLap: (config.enableTargetPitLap as boolean) ?? defaultConfig.enableTargetPitLap,
    targetPitLap: (config.targetPitLap as number) ?? defaultConfig.targetPitLap,
    fuelStatusThresholds: (config.fuelStatusThresholds as any) ?? defaultConfig.fuelStatusThresholds,
    fuelStatusBasis: (config.fuelStatusBasis as any) ?? defaultConfig.fuelStatusBasis,
    fuelStatusRedLaps: (config.fuelStatusRedLaps as any) ?? defaultConfig.fuelStatusRedLaps,
    avgLapsCount: (config.avgLapsCount as number) ?? defaultConfig.avgLapsCount,
  };
};



// Available Widgets for Fuel Calculator 2
const AVAILABLE_WIDGETS_FUEL2: { id: string; label: string }[] = [
  { id: 'fuel2Header', label: 'Header (Stops/Window/Confidence)' },
  { id: 'fuel2Confidence', label: 'Confidence Messages' },
  { id: 'fuel2Gauge', label: 'Fuel Gauge' },
  { id: 'fuel2Grid', label: 'Consumption Grid' },
  { id: 'fuel2Scenarios', label: 'Pit Scenarios' },
  { id: 'fuel2TargetMessage', label: 'Target Pit Message' },
  { id: 'fuel2Graph', label: 'Fuel History' },
  { id: 'fuel2TimeEmpty', label: 'Time Until Empty' },
];



const DEFAULT_TREE_FUEL2: LayoutNode = {
  id: 'root-fuel2-default',
  type: 'split',
  direction: 'col',
  children: [
    {
      id: 'box-1',
      type: 'box',
      direction: 'col',
      widgets: ['fuel2Header', 'fuel2Confidence', 'fuel2TargetMessage', 'fuel2Gauge', 'fuel2Grid', 'fuel2Scenarios', 'fuel2Graph', 'fuel2TimeEmpty'],
    }
  ]
};

const FontSizeInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId];
  // Default values per widget type if we wanted, but for now undefined implies CSS default
  // Just show empty if undefined
  const fontSize = style?.fontSize;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min="8"
        max="48"
        step="1"
        value={fontSize ?? 16}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          const newStyles = { ...settings.config.widgetStyles };

          newStyles[widgetId] = { ...newStyles[widgetId], fontSize: val };
          onChange({ widgetStyles: newStyles });
        }}
        className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-xs text-slate-300 w-8 text-right">{fontSize ?? 16}px</span>
    </div>
  );
};

const DualFontSizeInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId] || {};
  const labelSize = style.labelFontSize ?? style.fontSize ?? 12; // Default label smaller
  const valueSize = style.valueFontSize ?? style.fontSize ?? 20; // Default value larger

  const updateStyle = (key: 'labelFontSize' | 'valueFontSize', val: number) => {
    const newStyles = { ...settings.config.widgetStyles };
    newStyles[widgetId] = { ...newStyles[widgetId], [key]: val };
    onChange({ widgetStyles: newStyles });
  };

  return (
    <div className="flex flex-col gap-1 w-full max-w-[140px] mr-20">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-8">Label</span>
        <input
          type="range" min="8" max="48" step="1"
          value={labelSize}
          onChange={(e) => updateStyle('labelFontSize', parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-[10px] text-slate-300 w-4 text-right">{labelSize}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-8">Value</span>
        <input
          type="range" min="8" max="64" step="1"
          value={valueSize}
          onChange={(e) => updateStyle('valueFontSize', parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-[10px] text-slate-300 w-4 text-right">{valueSize}</span>
      </div>
    </div>
  );
};





const BarFontSizeInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const fontSize = style?.barFontSize;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-8">Inside</span>
      <input
        type="range"
        min="6"
        max="32"
        step="1"
        value={fontSize ?? 8}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          const newStyles = { ...settings.config.widgetStyles };
          newStyles[widgetId] = { ...newStyles[widgetId], barFontSize: val };
          onChange({ widgetStyles: newStyles });
        }}
        className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider w-[60px]" // Reduced width to fit
      />
      <span className="text-[10px] text-slate-300 w-4 text-right">{fontSize ?? 8}</span>
    </div>
  );
};

const HeightInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const height = style?.height;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min="40"
        max="300"
        step="5"
        value={height ?? 64}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          const newStyles = { ...settings.config.widgetStyles };
          newStyles[widgetId] = { ...newStyles[widgetId], height: val };
          onChange({ widgetStyles: newStyles });
        }}
        className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-xs text-slate-300 w-8 text-right">{height ?? 64}px</span>
    </div>
  );
};

interface SortableRow {
  id: string;
  label: string;
  configKey: keyof FuelWidgetSettings['config'];
}

const getSortableRows = (avgLapsCount: number): SortableRow[] => [
  { id: 'curr', label: 'Current Lap', configKey: 'showCurrentLap' },
  { id: 'avg', label: `Average (${avgLapsCount} Lap)`, configKey: 'show3LapAvg' },
  { id: 'max', label: 'Max Consumption', configKey: 'showMax' },
  { id: 'last', label: 'Last Lap', configKey: 'showLastLap' },
  { id: 'min', label: 'Min Consumption', configKey: 'showMin' },
];

const GridOrderSettingsList = ({ itemsOrder, onReorder, settings, handleConfigChange }: {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: FuelWidgetSettings;
  handleConfigChange: (changes: Partial<FuelWidgetSettings['config']>) => void;
}) => {
  const rows = getSortableRows(settings.config.avgLapsCount || 3);
  // Filter out any invalid IDs potentially saved in old configs
  const validIds = rows.map((r: SortableRow) => r.id);
  const items = itemsOrder
    .filter(id => validIds.includes(id))
    .map((id) => {
      const row = rows.find((r: SortableRow) => r.id === id);
      return row ? { ...row } : null;
    })
    .filter((r): r is SortableRow => r !== null);

  // If some default rows are missing (e.g. migration), append them
  rows.forEach((def: SortableRow) => {
    if (!items.find(i => i.id === def.id)) items.push(def);
  });

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-2 mt-2">
      {displayItems.map((row) => {
        const { dragHandleProps, itemProps } = getItemProps(row);
        const isEnabled = settings.config[row.configKey] as boolean;

        return (
          <div key={row.id} {...itemProps}>
            <div className="flex items-center justify-between group bg-slate-800/50 p-1.5 rounded border border-transparent hover:border-slate-600 transition-colors">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...dragHandleProps}
                  className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded text-slate-400"
                >
                  <DotsSixVerticalIcon size={14} />
                </div>
                <span className="text-xs text-slate-300 font-medium">{row.label}</span>
              </div>
              <ToggleSwitch
                enabled={isEnabled}
                onToggle={(val) => {
                  handleConfigChange({ [row.configKey]: val });
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SingleFuelWidgetSettings = ({ widgetId }: { widgetId: string }) => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as FuelWidgetSettings | undefined;

  const [settings, setSettings] = useState<FuelWidgetSettings>(() => {
    const initialConfig = migrateConfig(savedSettings?.config);

    // Use DEFAULT_TREE_FUEL2 if no layout is defined
    if ((!initialConfig.layoutConfig || initialConfig.layoutConfig.length === 0) && !initialConfig.layoutTree) {
      initialConfig.layoutTree = DEFAULT_TREE_FUEL2;
    }
    return {
      enabled: savedSettings?.enabled ?? false,
      config: initialConfig,
    };
  });

  const availableWidgets = AVAILABLE_WIDGETS_FUEL2;



  // Calculate tree state from settings (migrating if needed)
  const currentTree = useMemo(() => {
    // Validate that the tree has a type before using it
    if (settings.config.layoutTree && settings.config.layoutTree.type) return settings.config.layoutTree;
    // Auto-migrate legacy list to tree for the visualizer
    return migrateToTree(settings.config.layoutConfig || [], availableWidgets as any);
  }, [settings.config.layoutTree, settings.config.layoutConfig, availableWidgets]);

  if (!currentDashboard || !savedSettings) {
    return <div className="p-4 text-slate-400">Widget not found or loading...</div>;
  }

  return (
    <BaseSettingsSection
      title="Fuel Calculator Settings"
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
          <div className="space-y-6">
            {/* Main Visual Layout Editor */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium text-slate-200">Layout Editor</h3>
                <span className="text-xs text-slate-500">Drag to Split (Right/Bottom)</span>
              </div>

              {currentTree && (
                <LayoutVisualizer
                  tree={currentTree}
                  onChange={handleTreeUpdate}
                  availableWidgets={availableWidgets as any}
                />
              )}

              {/* General Control Toggles */}
              <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-300">Use General font Sizes</span>
                    <span className="block text-[10px] text-slate-500">Syncs with Font Size slider in General tab</span>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.useGeneralFontSize ?? false}
                    onToggle={(val) => handleConfigChange({ useGeneralFontSize: val })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-300">Use General Compact Mode</span>
                    <span className="block text-[10px] text-slate-500">Syncs with Compact Mode in General tab</span>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.useGeneralCompactMode ?? false}
                    onToggle={(val) => handleConfigChange({ useGeneralCompactMode: val })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-md font-medium text-slate-200">Widget Settings</h3>

              {/* Widget Styles for Fuel 2 specific components without toggles */}
              <div className="space-y-4 pb-4 mb-4 border-b border-slate-700">
                <div className="flex items-center justify-between pr-20 pb-4 border-b border-white/5">
                  <span className="text-sm text-slate-300">Header</span>
                  <DualFontSizeInput widgetId="fuel2Header" settings={settings} onChange={handleConfigChange} />
                </div>
                <div className="flex items-center justify-between pr-20 py-4 border-b border-white/5">
                  <span className="text-sm text-slate-300">Confidence Messages</span>
                  <DualFontSizeInput widgetId="fuel2Confidence" settings={settings} onChange={handleConfigChange} />
                </div>
                <div className="flex items-center justify-between pr-20 py-4 border-b border-white/5">
                  <span className="text-sm text-slate-300">Fuel Gauge</span>
                  <DualFontSizeInput widgetId="fuel2Gauge" settings={settings} onChange={handleConfigChange} />
                </div>
                <div className="flex items-center justify-between pr-20 py-4 border-b border-white/5">
                  <span className="text-sm text-slate-300">Time Until Empty</span>
                  <DualFontSizeInput widgetId="fuel2TimeEmpty" settings={settings} onChange={handleConfigChange} />
                </div>
              </div>
            </div>

            {/* Fuel Status Alerts */}
            <div className="space-y-4 pb-4 mb-4 border-b border-slate-700">
              <h4 className="text-sm font-medium text-slate-300">Fuel Status Alerts</h4>

              <div className="space-y-3">
                {/* Green Threshold */}
                <div className="flex items-center justify-between pr-20">
                  <span className="text-xs text-slate-400">Green Threshold (%)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0" max="100" step="1"
                      value={settings.config.fuelStatusThresholds?.green ?? 60}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleConfigChange({
                          fuelStatusThresholds: {
                            ...defaultConfig.fuelStatusThresholds,
                            ...settings.config.fuelStatusThresholds,
                            green: val
                          } as any
                        });
                      }}
                      className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 w-8 text-right">{settings.config.fuelStatusThresholds?.green ?? 60}%</span>
                  </div>
                </div>

                {/* Amber Threshold */}
                <div className="flex items-center justify-between pr-20">
                  <span className="text-xs text-slate-400">Amber Threshold (%)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0" max="100" step="1"
                      value={settings.config.fuelStatusThresholds?.amber ?? 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleConfigChange({
                          fuelStatusThresholds: {
                            ...defaultConfig.fuelStatusThresholds,
                            ...settings.config.fuelStatusThresholds,
                            amber: val
                          } as any
                        });
                      }}
                      className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 w-8 text-right">{settings.config.fuelStatusThresholds?.amber ?? 30}%</span>
                  </div>
                </div>

                {/* Red Threshold */}
                <div className="flex items-center justify-between pr-20">
                  <span className="text-xs text-slate-400">Red Threshold (%)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0" max="100" step="1"
                      value={settings.config.fuelStatusThresholds?.red ?? 10}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleConfigChange({
                          fuelStatusThresholds: {
                            ...defaultConfig.fuelStatusThresholds,
                            ...settings.config.fuelStatusThresholds,
                            red: val
                          } as any
                        });
                      }}
                      className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 w-8 text-right">{settings.config.fuelStatusThresholds?.red ?? 10}%</span>
                  </div>
                </div>

                {/* Consumption Basis */}
                <div className="flex items-center justify-between pr-20 mt-4">
                  <span className="text-xs text-slate-400">
                    Alert Basis (Override)
                    <span className="block text-[10px] text-slate-500">Triggers Red if below lap threshold</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.config.fuelStatusBasis ?? 'avg'}
                      onChange={(e) => handleConfigChange({ fuelStatusBasis: e.target.value as any })}
                      className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs w-24"
                    >
                      <option value="last">Last Lap</option>
                      <option value="avg">Average</option>
                      <option value="min">Minimum</option>
                      <option value="max">Maximum</option>
                    </select>
                    <input
                      type="number" min="0" max="20" step="0.1"
                      value={settings.config.fuelStatusRedLaps ?? 3}
                      onChange={(e) => handleConfigChange({ fuelStatusRedLaps: parseFloat(e.target.value) })}
                      className="w-12 px-1 py-1 bg-slate-700 text-slate-200 rounded text-xs text-center ml-2"
                    />
                    <span className="text-[10px] text-slate-500">Laps</span>
                  </div>
                </div>
              </div>
            </div>

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





            {/* Show Consumption Section - Available for BOTH */}
            <div className="flex items-center justify-between pr-20 py-4 border-b border-white/5">
              <span className="text-sm text-slate-300">
                Consumption Details
                <span className="block text-xs text-slate-500">Configures rows in Consumption Grid</span>
              </span>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Average Laps</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="1" max="50" step="1"
                      value={settings.config.avgLapsCount ?? 3}
                      onChange={(e) => handleConfigChange({ avgLapsCount: parseInt(e.target.value) })}
                      className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 w-8 text-right">{settings.config.avgLapsCount ?? 3}</span>
                  </div>
                </div>
                <DualFontSizeInput widgetId="fuel2Grid" settings={settings} onChange={handleConfigChange} />
              </div>

              {/* Fuel 2 Grid Reordering */}
              <div className="pl-2 pr-1">
                <GridOrderSettingsList
                  itemsOrder={settings.config.consumptionGridOrder || defaultConfig.consumptionGridOrder!}
                  onReorder={(newOrder) => handleConfigChange({ consumptionGridOrder: newOrder })}
                  settings={settings}
                  handleConfigChange={handleConfigChange}
                />
              </div>
            </div>



            {/* Fuel Scenarios */}
            <div className="flex items-center justify-between pr-20 py-4 border-b border-white/5">
              <span className="text-sm text-slate-300">Fuel Scenarios</span>
              <div className="flex items-center gap-4">
                <DualFontSizeInput widgetId="fuel2Scenarios" settings={settings} onChange={handleConfigChange} />
              </div>
            </div>



            {/* Fuel History */}
            <div className="py-4 border-b border-white/5">
              <div className="flex items-center justify-between pr-20 mb-2">
                <span className="text-sm text-slate-300">Fuel History</span>
                <DualFontSizeInput widgetId="fuel2Graph" settings={settings} onChange={handleConfigChange} />
              </div>

              {/* Sub-settings container */}
              <div className="ml-1 pl-3 border-l border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between pr-20">
                  <span className="text-xs text-slate-400">Graph Properties</span>
                  <div className="flex items-center gap-4">
                    <BarFontSizeInput widgetId="fuel2Graph" settings={settings} onChange={handleConfigChange} />
                    <HeightInput widgetId="fuel2Graph" settings={settings} onChange={handleConfigChange} />
                  </div>
                </div>

                {/* Allow configuring graph type for Fuel 2 as well */}
                {settings.config.showFuelHistory !== false && (
                  <div className="space-y-3">
                    {/* Graph Type & Target Wrapper */}
                    <div className="flex items-center justify-between pr-20">
                      <span className="text-xs text-slate-400">Graph Type</span>
                      <select
                        value={settings.config.fuelHistoryType}
                        onChange={(e) =>
                          handleConfigChange({
                            fuelHistoryType: e.target.value as 'line' | 'histogram',
                          })
                        }
                        className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded text-xs"
                      >
                        <option value="line">Line Chart</option>
                        <option value="histogram">Histogram</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pr-20">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-400">Target Line</span>
                        <span className="text-[10px] text-slate-500">Optional ref (0 to hide)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="None"
                          value={settings.config.manualTarget ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                            handleConfigChange({ manualTarget: val });
                          }}
                          className="w-16 px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs text-right focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">{settings.config.fuelUnits}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Safety Margin */}
            <div className="flex items-center justify-between pr-20">
              <span className="text-sm text-slate-300">
                Safety Margin
                <span className="block text-xs text-slate-500">
                  Extra fuel buffer (affects &quot;To Finish&quot; and border
                  colors)
                </span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={settings.config.safetyMargin * 100}
                  onChange={(e) =>
                    handleConfigChange({
                      safetyMargin: parseInt(e.target.value) / 100,
                    })
                  }
                  className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-xs text-slate-300 w-8">
                  {Math.round(settings.config.safetyMargin * 100)}%
                </span>
              </div>
            </div>

            {/* Background Opacity */}
            <div className="flex items-center justify-between pr-20">
              <span className="text-sm text-slate-300">Background Opacity</span>
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


            {/* Pit Strategy Section */}
            <div className="border-t border-slate-600/50 pt-6 space-y-4">
              <h3 className="text-md font-medium text-slate-200">🎯 Pit Strategy</h3>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Fixed Target Lap</span>
                  <span className="block text-xs text-slate-500">Enable a specific lap target for strategy</span>
                </div>
                <ToggleSwitch
                  enabled={settings.config.enableTargetPitLap || false}
                  onToggle={(val) => handleConfigChange({ enableTargetPitLap: val })}
                />
              </div>

              {(settings.config.enableTargetPitLap) && (
                <div className="ml-4 p-3 bg-slate-800/50 rounded border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Target Pit Lap</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">L</span>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={settings.config.targetPitLap ?? 15}
                        onChange={(e) => handleConfigChange({ targetPitLap: parseInt(e.target.value) || 1 })}
                        className="w-16 px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs text-right focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pr-20">
                    <span className="text-[10px] text-slate-400">Target Message Font</span>
                    <DualFontSizeInput widgetId="fuel2TargetMessage" settings={settings} onChange={handleConfigChange} />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    Scenarios will include this lap as a 4th row. Target message will show fuel required.
                  </p>
                </div>
              )}
            </div>

            {/* Session Visibility Settings */}
            <div className="space-y-4 border-t border-slate-600/50 pt-6">
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
                    <h4 className="text-sm font-medium text-slate-300">
                      Show only when on track
                    </h4>
                    <span className="block text-[10px] text-slate-500">
                      If enabled, calculator will only be shown when you are driving.
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


          </div>
        );
      }}
    </BaseSettingsSection >
  );
};

export const FuelSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const widgetType = 'fuel2';

  // Identify widgets of the target type
  const fuelWidgets = currentDashboard?.widgets.filter(
    (w) => w.type === widgetType
  ) || [];

  const [selectedId, setSelectedId] = useState(() => {
    if (fuelWidgets.length > 0) return fuelWidgets[0].id;
    return '';
  });

  const handleAddWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;

    // Create new widget ID
    const newId = `${widgetType}-${generateId()}`;
    // Create new widget structure
    const newWidget = {
      id: newId,
      type: widgetType,
      enabled: true,
      layout: { x: 50, y: 50, width: 300, height: 400 }, // Default window size
      config: defaultConfig, // Start with default config
    };

    // Update Dashboard
    onDashboardUpdated(
      {
        ...currentDashboard,
        widgets: [...currentDashboard.widgets, newWidget],
      }
    );

    // Select the new widget
    setSelectedId(newId);
  };

  const handleDeleteWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;

    const newWidgets = currentDashboard.widgets.filter((w) => w.id !== selectedId);

    onDashboardUpdated(
      {
        ...currentDashboard,
        widgets: newWidgets,
      }
    );

    // Reset selection
    const remaining = newWidgets.filter(w => w.type === widgetType);
    if (remaining.length > 0) setSelectedId(remaining[0].id);
    else setSelectedId('');
  };

  // If no widgets and we're in fuel2 mode, show create button prominently or handle empty state
  if (fuelWidgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-200">Fuel Calculator</h3>
        <p className="text-slate-400">No fuel calculator widgets added yet.</p>
        <button
          onClick={handleAddWidget}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
        >
          <PlusIcon size={20} /> Create New Widget
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full overflow-y-auto p-1">
      {/* Top Manager Bar */}
      <div className="bg-slate-800 p-3 rounded flex items-center justify-between border border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-200">Editing Widget:</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-slate-900 border border-slate-600 text-white text-sm rounded px-2 py-1"
          >
            {fuelWidgets.map(w => (
              <option key={w.id} value={w.id}>
                {w.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteWidget}
            className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-800 transition-colors"
          >
            Delete Layout
          </button>
          <button
            onClick={handleAddWidget}
            className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
          >
            <PlusIcon /> New Layout
          </button>
        </div>
      </div>

      {/* Render settings for selected ID */}
      {selectedId && <SingleFuelWidgetSettings key={selectedId} widgetId={selectedId} />}
    </div>
  );
};
