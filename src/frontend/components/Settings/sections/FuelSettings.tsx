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
            <ToggleSwitch
              enabled={settings.config.showConsumption}
              onToggle={(newValue) =>
                handleConfigChange({ showConsumption: newValue })
              }
            />
          </div>

          {/* Consumption Details (when enabled) */}
          {settings.config.showConsumption && (
            <div className="ml-4 space-y-2 pl-4">
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
                <span className="text-xs text-slate-300">
                  Show 3 Lap Average
                </span>
                <ToggleSwitch
                  enabled={settings.config.show3LapAvg}
                  onToggle={(newValue) =>
                    handleConfigChange({ show3LapAvg: newValue })
                  }
                />
              </div>
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Show Max</span>
                <ToggleSwitch
                  enabled={settings.config.showMax}
                  onToggle={(newValue) =>
                    handleConfigChange({ showMax: newValue })
                  }
                />
              </div>
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
              {settings.config.showFuelRequired && (
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
            <ToggleSwitch
              enabled={settings.config.showPitWindow}
              onToggle={(newValue) =>
                handleConfigChange({ showPitWindow: newValue })
              }
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
            <ToggleSwitch
              enabled={settings.config.showEnduranceStrategy}
              onToggle={(newValue) =>
                handleConfigChange({ showEnduranceStrategy: newValue })
              }
            />
          </div>

          {/* Show Fuel Scenarios */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Show Fuel Scenarios</span>
            <ToggleSwitch
              enabled={settings.config.showFuelScenarios}
              onToggle={(newValue) =>
                handleConfigChange({ showFuelScenarios: newValue })
              }
            />
          </div>

          {/* Show Consumption Graph */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Show Consumption Graph
            </span>
            <ToggleSwitch
              enabled={settings.config.showConsumptionGraph}
              onToggle={(newValue) =>
                handleConfigChange({ showConsumptionGraph: newValue })
              }
            />
          </div>

          {/* Graph Type (when enabled) */}
          {settings.config.showConsumptionGraph && (
            <div className="ml-4 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">
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
                className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
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
      )}
    </BaseSettingsSection>
  );
};
