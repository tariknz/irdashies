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
  };
};

// Available Widgets for Legacy Fuel Calculator
const AVAILABLE_WIDGETS: { id: FuelWidgetType; label: string }[] = [
  { id: 'fuelLevel', label: 'Fuel Level Header' },
  { id: 'lapsRemaining', label: 'Laps Remaining Header' },
  { id: 'fuelHeader', label: 'Combined Header (Fuel + Laps)' },
  { id: 'consumption', label: 'Consumption Table' },
  { id: 'keyInfo', label: 'Key Info (To Finish/Add)' },
  { id: 'pitWindow', label: 'Pit Window' },
  { id: 'endurance', label: 'Endurance Info' },
  { id: 'scenarios', label: 'Target Scenarios' },
  { id: 'graph', label: 'Consumption Graph' },
  { id: 'confidence', label: 'Confidence Indicator' },
];

// Available Widgets for Fuel Calculator 2
const AVAILABLE_WIDGETS_FUEL2: { id: string; label: string }[] = [
  { id: 'fuel2Header', label: 'Header (Stops/Window/Confidence)' },
  { id: 'fuel2Gauge', label: 'Fuel Gauge' },
  { id: 'fuel2Grid', label: 'Consumption Grid' },
  { id: 'fuel2Scenarios', label: 'Pit Scenarios' },
  { id: 'fuel2Graph', label: 'Fuel History' },
  { id: 'fuel2TimeEmpty', label: 'Time Until Empty' },
];

const DEFAULT_TREE: LayoutNode = {
  id: 'root-default',
  type: 'split',
  direction: 'col',
  children: [
    {
      id: 'header-box',
      type: 'box',
      direction: 'row',
      widgets: ['fuelHeader'],
      weight: 1
    },
    {
      id: 'main-box',
      type: 'box',
      direction: 'col',
      widgets: [
        'consumption',
        'keyInfo',
        'endurance',
        'pitWindow',
        'scenarios',
        'graph',
        'confidence'
      ],
      weight: 4
    }
  ]
};

const DEFAULT_TREE_FUEL2: LayoutNode = {
  id: 'root-fuel2-default',
  type: 'split',
  direction: 'col',
  children: [
    {
      id: 'box-1',
      type: 'box',
      direction: 'col',
      widgets: ['fuel2Header', 'fuel2Gauge', 'fuel2Grid', 'fuel2Scenarios', 'fuel2Graph', 'fuel2TimeEmpty'],
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
    <div className="flex flex-col gap-1 w-full max-w-[160px]">
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



interface SortableRow {
  id: string;
  label: string;
  configKey: keyof FuelWidgetSettings['config'];
}

const sortableRows: SortableRow[] = [
  { id: 'curr', label: 'Current Lap', configKey: 'showCurrentLap' },
  { id: 'avg', label: 'Average (3 Lap)', configKey: 'show3LapAvg' },
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
  // Filter out any invalid IDs potentially saved in old configs
  const validIds = sortableRows.map(r => r.id);
  const items = itemsOrder
    .filter(id => validIds.includes(id))
    .map((id) => {
      const row = sortableRows.find((r) => r.id === id);
      return row ? { ...row } : null;
    })
    .filter((r): r is SortableRow => r !== null);

  // If some default rows are missing (e.g. migration), append them
  sortableRows.forEach(def => {
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

const SingleFuelWidgetSettings = ({ widgetId, isFuel2 }: { widgetId: string, isFuel2: boolean }) => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as FuelWidgetSettings | undefined;

  // Uses isFuel2 passed from parent to avoid race condition with savedSettings being undefined on first render
  // const isFuel2 = savedSettings?.type === 'fuel2'; 

  const [settings, setSettings] = useState<FuelWidgetSettings>(() => {
    const initialConfig = migrateConfig(savedSettings?.config);

    // Use DEFAULT_TREE if no layout is defined
    if ((!initialConfig.layoutConfig || initialConfig.layoutConfig.length === 0) && !initialConfig.layoutTree) {
      initialConfig.layoutTree = isFuel2 ? DEFAULT_TREE_FUEL2 : DEFAULT_TREE;
    }
    return {
      enabled: savedSettings?.enabled ?? false,
      config: initialConfig,
    };
  });

  const availableWidgets = isFuel2 ? AVAILABLE_WIDGETS_FUEL2 : AVAILABLE_WIDGETS;



  // Calculate tree state from settings (migrating if needed)
  const currentTree = useMemo(() => {
    // Validate that the tree has a type before using it
    if (settings.config.layoutTree && settings.config.layoutTree.type) return settings.config.layoutTree;
    // Auto-migrate legacy list to tree for the visualizer
    return migrateToTree(settings.config.layoutConfig || [], availableWidgets as any);
  }, [settings.config.layoutTree, settings.config.layoutConfig, availableWidgets, isFuel2]);

  if (!currentDashboard || !savedSettings) {
    return <div className="p-4 text-slate-400">Widget not found or loading...</div>;
  }

  return (
    <BaseSettingsSection
      title={isFuel2 ? "Fuel Calculator 2 Settings" : "Fuel Calculator Configuration"}
      description={isFuel2 ? "Configure the Fuel Calculator 2 layout." : "Configure fuel consumption tracking, pit stop calculations, and custom layout."}
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
            <div className="space-y-2">
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
            </div>

            <div className={`${isFuel2 ? '' : 'border-t border-slate-600/50 pt-6'} space-y-4`}>
              <h3 className="text-md font-medium text-slate-200">Widget Settings</h3>

              {/* Widget Styles for Fuel 2 specific components without toggles */}
              {isFuel2 && (
                <div className="space-y-4 pb-4 mb-4 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">(Stops/Window/Confidence)</span>
                    <DualFontSizeInput widgetId="fuel2Header" settings={settings} onChange={handleConfigChange} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Fuel Gauge</span>
                    <DualFontSizeInput widgetId="fuel2Gauge" settings={settings} onChange={handleConfigChange} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Time Until Empty</span>
                    <DualFontSizeInput widgetId="fuel2TimeEmpty" settings={settings} onChange={handleConfigChange} />
                  </div>
                </div>
              )}

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

              {/* Global Layout Style - Legacy Only */}
              {!isFuel2 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Global Layout Style
                    <span className="block text-xs text-slate-500">
                      Controls font sizes and basic widget orientation (Vertical/Horizontal)
                    </span>
                  </span>
                  <select
                    value={settings.config.layout}
                    onChange={(e) =>
                      handleConfigChange({
                        layout: e.target.value as 'vertical' | 'horizontal',
                      })
                    }
                    className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm"
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </div>
              )}

              {/* Display Options */}
              {/* Header Visibility Toggles - Legacy Only (Modern has fixed headers in widgets) */}
              {!isFuel2 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Show Fuel Level Header</span>
                    <ToggleSwitch
                      enabled={settings.config.showFuelLevel}
                      onToggle={(newValue) =>
                        handleConfigChange({ showFuelLevel: newValue })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Show Laps Remaining Header</span>
                    <ToggleSwitch
                      enabled={settings.config.showLapsRemaining}
                      onToggle={(newValue) =>
                        handleConfigChange({ showLapsRemaining: newValue })
                      }
                    />
                  </div>
                </>
              )}

              {/* Show Consumption Section - Available for BOTH */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Consumption Details
                  {isFuel2 && <span className="block text-xs text-slate-500">Configures rows in Consumption Grid</span>}
                </span>
                <div className="flex items-center gap-4">
                  {isFuel2 && <DualFontSizeInput widgetId="fuel2Grid" settings={settings} onChange={handleConfigChange} />}
                  {!isFuel2 && (
                    <ToggleSwitch
                      enabled={settings.config.showConsumption}
                      onToggle={(newValue) =>
                        handleConfigChange({ showConsumption: newValue })
                      }
                    />
                  )}
                </div>

                {/* Fuel 2 Grid Reordering */}
                {isFuel2 && (
                  <div className="pl-2 pr-1">
                    <GridOrderSettingsList
                      itemsOrder={settings.config.consumptionGridOrder || defaultConfig.consumptionGridOrder!}
                      onReorder={(newOrder) => handleConfigChange({ consumptionGridOrder: newOrder })}
                      settings={settings}
                      handleConfigChange={handleConfigChange}
                    />
                  </div>
                )}
              </div>

              {/* Consumption Details (when enabled) */}
              {settings.config.showConsumption && !isFuel2 && (
                <div className="ml-4 space-y-2 pl-4 border-l border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Show Min</span>
                    <ToggleSwitch
                      enabled={settings.config.showMin}
                      onToggle={(newValue) =>
                        handleConfigChange({ showMin: newValue })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Show Last Lap</span>
                    <ToggleSwitch
                      enabled={settings.config.showLastLap}
                      onToggle={(newValue) =>
                        handleConfigChange({ showLastLap: newValue })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Show Current Lap</span>
                    <ToggleSwitch
                      enabled={settings.config.showCurrentLap}
                      onToggle={(newValue) =>
                        handleConfigChange({ showCurrentLap: newValue })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">
                      Show 3 Lap Average
                      {isFuel2 && <span className="block text-[10px] text-slate-500">Controls AVG row</span>}
                    </span>
                    <ToggleSwitch
                      enabled={settings.config.show3LapAvg}
                      onToggle={(newValue) =>
                        handleConfigChange({ show3LapAvg: newValue })
                      }
                    />
                  </div>
                  {!isFuel2 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        Show 10 Lap Average
                      </span>
                      <ToggleSwitch
                        enabled={settings.config.show10LapAvg}
                        onToggle={(newValue) =>
                          handleConfigChange({ show10LapAvg: newValue })
                        }
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Show Max</span>
                    <ToggleSwitch
                      enabled={settings.config.showMax}
                      onToggle={(newValue) =>
                        handleConfigChange({ showMax: newValue })
                      }
                    />
                  </div>
                  {!isFuel2 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        Show Fuel Required
                        <span className="block text-[10px] text-slate-500">
                          Fuel needed for min/avg/max
                        </span>
                      </span>
                      <ToggleSwitch
                        enabled={settings.config.showFuelRequired}
                        onToggle={(newValue) =>
                          handleConfigChange({ showFuelRequired: newValue })
                        }
                      />
                    </div>
                  )}
                  {settings.config.showFuelRequired && !isFuel2 && (
                    <div className="ml-4 mt-2 pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">
                          Display Mode
                          <span className="block text-[10px] text-slate-500">
                            To Finish: Total fuel needed | To Add: Fuel to add at
                            stop
                          </span>
                        </span>
                        <select
                          value={settings.config.fuelRequiredMode}
                          onChange={(e) =>
                            handleConfigChange({
                              fuelRequiredMode: e.target.value as
                                | 'toFinish'
                                | 'toAdd',
                            })
                          }
                          className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm"
                        >
                          <option value="toFinish">To Finish</option>
                          <option value="toAdd">Fuel to Add</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show Pit Window */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Pit Window</span>
                {!isFuel2 && (
                  <ToggleSwitch
                    enabled={settings.config.showPitWindow}
                    onToggle={(newValue) =>
                      handleConfigChange({ showPitWindow: newValue })
                    }
                  />
                )}
              </div>

              {/* Show Endurance Strategy */}
              {!isFuel2 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Show Endurance Strategy
                    <span className="block text-xs text-slate-500">
                      Total pit stops and stint info for long races
                    </span>
                  </span>
                  <ToggleSwitch
                    enabled={settings.config.showEnduranceStrategy}
                    onToggle={(newValue) =>
                      handleConfigChange({ showEnduranceStrategy: newValue })
                    }
                  />
                </div>
              )}

              {/* Fuel Scenarios */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Fuel Scenarios</span>
                <div className="flex items-center gap-4">
                  {isFuel2 && <DualFontSizeInput widgetId="fuel2Scenarios" settings={settings} onChange={handleConfigChange} />}
                  {!isFuel2 && (
                    <ToggleSwitch
                      enabled={settings.config.showFuelScenarios}
                      onToggle={(newValue) =>
                        handleConfigChange({ showFuelScenarios: newValue })
                      }
                    />
                  )}
                </div>
              </div>

              {/* Fuel History - Legacy Only */}
              {!isFuel2 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Fuel History
                    </span>
                    <ToggleSwitch
                      enabled={settings.config.showFuelHistory}
                      onToggle={(newValue) =>
                        handleConfigChange({ showFuelHistory: newValue })
                      }
                    />
                  </div>

                  {settings.config.showFuelHistory && (
                    <div className="ml-4 pl-4 border-l border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">
                          Graph Type
                          <span className="block text-[10px] text-slate-500">
                            Line: 5 laps, Histogram: 30 laps
                          </span>
                        </span>
                        <select
                          value={settings.config.fuelHistoryType}
                          onChange={(e) =>
                            handleConfigChange({
                              fuelHistoryType: e.target.value as
                                | 'line'
                                | 'histogram',
                            })
                          }
                          className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm"
                        >
                          <option value="line">Line Chart</option>
                          <option value="histogram">Histogram</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Fuel History - Fuel 2 */}
              {isFuel2 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Fuel History
                    </span>
                    <div className="flex items-center gap-4">
                      {/* Slider removed as requested */}
                    </div>
                  </div>

                  {/* Allow configuring graph type for Fuel 2 as well */}
                  {settings.config.showFuelHistory !== false && (
                    <div className="ml-4 pl-4 border-l border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">Graph Type</span>
                        <select
                          value={settings.config.fuelHistoryType}
                          onChange={(e) =>
                            handleConfigChange({
                              fuelHistoryType: e.target.value as 'line' | 'histogram',
                            })
                          }
                          className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm"
                        >
                          <option value="line">Line Chart</option>
                          <option value="histogram">Histogram</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">
                          Target Line
                          <span className="block text-[10px] text-slate-500">
                            Optional target ref (0 to hide)
                          </span>
                        </span>
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
                </>
              )}

              {/* Safety Margin */}
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
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

              {/* IsOnTrack Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-medium text-slate-300">
                    Show only when on track
                  </h4>
                  <span className="block text-xs text-slate-500">
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

              {/* Session Visibility Settings */}
              <div className="space-y-4">
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
                </div>
              </div>


            </div>
          </div>
        );
      }}
    </BaseSettingsSection >
  );
};

export const FuelSettings = ({ widgetType = 'fuel' }: { widgetType?: 'fuel' | 'fuel2' }) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  // Identify widgets of the target type
  const fuelWidgets = currentDashboard?.widgets.filter(
    (w) => w.type === widgetType || (widgetType === 'fuel' && w.id === 'fuel')
  ) || [];

  const [selectedId, setSelectedId] = useState(() => {
    if (fuelWidgets.length > 0) return fuelWidgets[0].id;
    return widgetType === 'fuel' ? 'fuel' : '';
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
    if (selectedId === 'fuel') return; // Protect main widget

    const newWidgets = currentDashboard.widgets.filter((w) => w.id !== selectedId);

    onDashboardUpdated(
      {
        ...currentDashboard,
        widgets: newWidgets,
      }
    );

    // Reset selection
    const remaining = newWidgets.filter(w => w.type === widgetType || (widgetType === 'fuel' && w.id === 'fuel'));
    if (remaining.length > 0) setSelectedId(remaining[0].id);
    else setSelectedId('');
  };

  // If no widgets and we're in fuel2 mode, show create button prominently or handle empty state
  if (fuelWidgets.length === 0 && widgetType === 'fuel2') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-200">Fuel Calculator 2</h3>
        <p className="text-slate-400">No modern fuel calculator widgets added yet.</p>
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
                {w.id === 'fuel' ? 'Main Fuel Calculator' : `${w.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedId !== 'fuel' && (
            <button
              onClick={handleDeleteWidget}
              className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-800 transition-colors"
            >
              Delete Layout
            </button>
          )}
          <button
            onClick={handleAddWidget}
            className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
          >
            <PlusIcon /> New Layout
          </button>
        </div>
      </div>

      {/* Render settings for selected ID */}
      {selectedId && (() => {
        const selectedWidget = fuelWidgets.find(w => w.id === selectedId);
        // Infer type if widget not yet in list (race condition) or use widget property
        const isSelectedFuel2 = selectedWidget ? selectedWidget.type === 'fuel2' : (selectedId.startsWith('fuel2') || widgetType === 'fuel2');

        return <SingleFuelWidgetSettings key={selectedId} widgetId={selectedId} isFuel2={isSelectedFuel2} />;
      })()}
    </div>
  );
};
