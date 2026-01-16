import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FuelWidgetSettings, SessionVisibilitySettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'fuel';

const defaultConfig: FuelWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  fuelUnits: 'L',
  layout: 'vertical',
  showConsumption: true,
  showMin: true,
  showLastLap: true,
  show3LapAvg: true,
  show10LapAvg: true,
  showMax: true,
  showPitWindow: true,
  showEnduranceStrategy: false,
  showFuelScenarios: true,
  showFuelRequired: false,
  showConsumptionGraph: true,
  consumptionGraphType: 'histogram',
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
};

const migrateConfig = (savedConfig: unknown): FuelWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    showOnlyWhenOnTrack:
      (config.isOnTrack as boolean) ?? defaultConfig.showOnlyWhenOnTrack,
    fuelUnits: (config.fuelUnits as 'L' | 'gal') ?? 'L',
    layout: (config.layout as 'vertical' | 'horizontal') ?? 'vertical',
    showConsumption: (config.showConsumption as boolean) ?? true,
    showMin: (config.showMin as boolean) ?? true,
    showLastLap: (config.showLastLap as boolean) ?? true,
    show3LapAvg: (config.show3LapAvg as boolean) ?? true,
    show10LapAvg: (config.show10LapAvg as boolean) ?? true,
    showMax: (config.showMax as boolean) ?? true,
    showPitWindow: (config.showPitWindow as boolean) ?? true,
    showEnduranceStrategy: (config.showEnduranceStrategy as boolean) ?? false,
    showFuelScenarios:
      (config.showFuelScenarios as boolean) ??
      (config.showFuelSave as boolean) ??
      true,
    showFuelRequired: (config.showFuelRequired as boolean) ?? false,
    showConsumptionGraph: (config.showConsumptionGraph as boolean) ?? true,
    consumptionGraphType:
      (config.consumptionGraphType as 'line' | 'histogram') ?? 'histogram',
    safetyMargin: (config.safetyMargin as number) ?? 0.05,
    background: {
      opacity: (config.background as { opacity?: number })?.opacity ?? 85,
    },
    fuelRequiredMode:
      (config.fuelRequiredMode as 'toFinish' | 'toAdd') ?? 'toFinish',
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const FuelSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FuelWidgetSettings | undefined;
  const [settings, setSettings] = useState<FuelWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  // Sync settings when dashboard changes (e.g., after layout edit)
  useEffect(() => {
    if (savedSettings) {
      setSettings({
        enabled: savedSettings.enabled,
        config: migrateConfig(savedSettings.config),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDashboard]); // savedSettings derived from currentDashboard

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Fuel Calculator"
      description="Configure fuel consumption tracking and pit stop calculations."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
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

          {/* Layout Style */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Layout Style
              <span className="block text-xs text-slate-500">
                Horizontal: wide bar for top/bottom of screen
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

          {/* Show Consumption Section */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Show Consumption Details
            </span>
            <input
              type="checkbox"
              checked={settings.config.showConsumption}
              onChange={(e) =>
                handleConfigChange({ showConsumption: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Consumption Details (when enabled) */}
          {settings.config.showConsumption && (
            <div className="ml-4 space-y-2 border-l-2 border-slate-600 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Show Min</span>
                <input
                  type="checkbox"
                  checked={settings.config.showMin}
                  onChange={(e) =>
                    handleConfigChange({ showMin: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Show Last Lap</span>
                <input
                  type="checkbox"
                  checked={settings.config.showLastLap}
                  onChange={(e) =>
                    handleConfigChange({ showLastLap: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Show 3 Lap Average
                </span>
                <input
                  type="checkbox"
                  checked={settings.config.show3LapAvg}
                  onChange={(e) =>
                    handleConfigChange({ show3LapAvg: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Show 10 Lap Average
                </span>
                <input
                  type="checkbox"
                  checked={settings.config.show10LapAvg}
                  onChange={(e) =>
                    handleConfigChange({ show10LapAvg: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Show Max</span>
                <input
                  type="checkbox"
                  checked={settings.config.showMax}
                  onChange={(e) =>
                    handleConfigChange({ showMax: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Show Fuel Required
                  <span className="block text-[10px] text-slate-500">
                    Fuel needed for min/avg/max
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.config.showFuelRequired}
                  onChange={(e) =>
                    handleConfigChange({ showFuelRequired: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
              {settings.config.showFuelRequired && (
                <div className="ml-4 mt-2 border-l-2 border-slate-600 pl-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
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
            <input
              type="checkbox"
              checked={settings.config.showPitWindow}
              onChange={(e) =>
                handleConfigChange({ showPitWindow: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Show Endurance Strategy */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Show Endurance Strategy
              <span className="block text-xs text-slate-500">
                Total pit stops and stint info for long races
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.config.showEnduranceStrategy}
              onChange={(e) =>
                handleConfigChange({ showEnduranceStrategy: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Show Fuel Scenarios */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Show Fuel Scenarios</span>
            <input
              type="checkbox"
              checked={settings.config.showFuelScenarios}
              onChange={(e) =>
                handleConfigChange({ showFuelScenarios: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Show Consumption Graph */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Show Consumption Graph
            </span>
            <input
              type="checkbox"
              checked={settings.config.showConsumptionGraph}
              onChange={(e) =>
                handleConfigChange({ showConsumptionGraph: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Graph Type (when enabled) */}
          {settings.config.showConsumptionGraph && (
            <div className="ml-4 border-l-2 border-slate-600 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Graph Type
                  <span className="block text-[10px] text-slate-500">
                    Line: 5 laps, Histogram: 30 laps
                  </span>
                </span>
                <select
                  value={settings.config.consumptionGraphType}
                  onChange={(e) =>
                    handleConfigChange({
                      consumptionGraphType: e.target.value as
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
                className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-slate-400 w-8">
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
                className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-slate-400 w-8">
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
      )}
    </BaseSettingsSection>
  );
};
