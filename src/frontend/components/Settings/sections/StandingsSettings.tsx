import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'standings';

const defaultConfig: StandingsWidgetSettings['config'] = {
  iRatingChange: { enabled: true },
  badge: { enabled: true },
  delta: { enabled: true },
  lastTime: { enabled: true },
  fastestTime: { enabled: true },
  background: { opacity: 0 },
  countryFlags: { enabled: true },
  carNumber: { enabled: true },
  driverStandings: {
    buffer: 3,
    numNonClassDrivers: 3,
    minPlayerClassDrivers: 10,
    numTopDrivers: 3,
  },
  compound: { enabled: true },
  carManufacturer: { enabled: true },
  lapTimeDeltas: { enabled: false, numLaps: 3 },
  titleBar: { enabled: true, progressBar: { enabled: true } },
  showOnlyWhenOnTrack: false
};

// Migration function to handle missing properties in the new config format
const migrateConfig = (
  savedConfig: unknown
): StandingsWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  // Handle new format with missing properties
  return {
    iRatingChange: {
      enabled:
        (config.iRatingChange as { enabled?: boolean })?.enabled ?? true,
    },
    badge: { enabled: (config.badge as { enabled?: boolean })?.enabled ?? true },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    lastTime: {
      enabled: (config.lastTime as { enabled?: boolean })?.enabled ?? true,
    },
    fastestTime: {
      enabled: (config.fastestTime as { enabled?: boolean })?.enabled ?? true,
    },
    background: {
      opacity: (config.background as { opacity?: number })?.opacity ?? 0,
    },
    countryFlags: {
      enabled: (config.countryFlags as { enabled?: boolean })?.enabled ?? true,
    },
    carNumber: {
      enabled: (config.carNumber as { enabled?: boolean })?.enabled ?? true,
    },
    driverStandings: {
      buffer:
        (config.driverStandings as { buffer?: number })?.buffer ??
        defaultConfig.driverStandings.buffer,
      numNonClassDrivers:
        (config.driverStandings as { numNonClassDrivers?: number })
          ?.numNonClassDrivers ??
        defaultConfig.driverStandings.numNonClassDrivers,
      minPlayerClassDrivers:
        (config.driverStandings as { minPlayerClassDrivers?: number })
          ?.minPlayerClassDrivers ??
        defaultConfig.driverStandings.minPlayerClassDrivers,
      numTopDrivers:
        (config.driverStandings as { numTopDrivers?: number })?.numTopDrivers ??
        defaultConfig.driverStandings.numTopDrivers,
    },
    compound: {
      enabled: (config.compound as { enabled?: boolean })?.enabled ?? true,
    },
    carManufacturer: {
      enabled: (config.carManufacturer as { enabled?: boolean })?.enabled ?? true,
    },
    lapTimeDeltas: {
      enabled: (config.lapTimeDeltas as { enabled?: boolean })?.enabled ?? false,
      numLaps: (config.lapTimeDeltas as { numLaps?: number })?.numLaps ?? 3,
    },
    titleBar: {
      enabled: (config.titleBar as { enabled?: boolean })?.enabled ?? true,
      progressBar: {
        enabled: (config.titleBar as { progressBar?: { enabled?: boolean } })?.progressBar?.enabled ?? true
      }
    },
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? false
  };
};

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(w => w.id === SETTING_ID) as StandingsWidgetSettings | undefined;
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Standings Settings"
      description="Configure how the standings widget appears and behaves."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-8">
          {/* Display Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Display Settings</h3>
            </div>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show iRating Changes</span>
                <ToggleSwitch
                  enabled={settings.config.iRatingChange.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ iRatingChange: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Driver Badge</span>
                <ToggleSwitch
                  enabled={settings.config.badge.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ badge: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Delta</span>
                <ToggleSwitch
                  enabled={settings.config.delta.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ delta: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Last Time</span>
                <ToggleSwitch
                  enabled={settings.config.lastTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ lastTime: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Fastest Time</span>
                <ToggleSwitch
                  enabled={settings.config.fastestTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ fastestTime: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Car Number</span>
                <ToggleSwitch
                  enabled={settings.config.carNumber.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ carNumber: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Country Flags</span>
                <ToggleSwitch
                  enabled={settings.config.countryFlags.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ countryFlags: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Tire Compound</span>
                <ToggleSwitch
                  enabled={settings.config.compound.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ compound: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Car Manufacturer</span>
                <ToggleSwitch
                  enabled={settings.config.carManufacturer.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ carManufacturer: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Lap Time Deltas</span>
                <ToggleSwitch
                  enabled={settings.config.lapTimeDeltas.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      lapTimeDeltas: {
                        ...settings.config.lapTimeDeltas,
                        enabled
                      }
                    })
                  }
                />
              </div>
              {settings.config.lapTimeDeltas.enabled && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-slate-300">Number of Laps to Show</span>
                  <select
                    value={settings.config.lapTimeDeltas.numLaps}
                    onChange={(e) =>
                      handleConfigChange({
                        lapTimeDeltas: {
                          ...settings.config.lapTimeDeltas,
                          numLaps: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          {/* Driver Standings Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Driver Standings
              </h3>
            </div>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Drivers to show around player
                </span>
                <input
                  type="number"
                  min={0}
                  value={settings.config.driverStandings.buffer}
                  onChange={(e) =>
                    handleConfigChange({
                      driverStandings: {
                        ...settings.config.driverStandings,
                        buffer: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Drivers to show in other classes
                </span>
                <input
                  type="number"
                  min={0}
                  value={settings.config.driverStandings.numNonClassDrivers}
                  onChange={(e) =>
                    handleConfigChange({
                      driverStandings: {
                        ...settings.config.driverStandings,
                        numNonClassDrivers: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Minimum drivers in player&apos;s class
                </span>
                <input
                  type="number"
                  min={0}
                  value={settings.config.driverStandings.minPlayerClassDrivers}
                  onChange={(e) =>
                    handleConfigChange({
                      driverStandings: {
                        ...settings.config.driverStandings,
                        minPlayerClassDrivers: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Top drivers to always show in player&apos;s class
                </span>
                <input
                  type="number"
                  min={0}
                  value={settings.config.driverStandings.numTopDrivers}
                  onChange={(e) =>
                    handleConfigChange({
                      driverStandings: {
                        ...settings.config.driverStandings,
                        numTopDrivers: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* Title Bar Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Title Bar</h3>
            </div>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Title Bar</span>
                <ToggleSwitch
                  enabled={settings.config.titleBar.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      titleBar: {
                        ...settings.config.titleBar,
                        enabled
                      }
                    })
                  }
                />
              </div>
              {settings.config.titleBar.enabled && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-slate-300">Show Progress Bar</span>
                  <ToggleSwitch
                    enabled={settings.config.titleBar.progressBar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        titleBar: {
                          ...settings.config.titleBar,
                          progressBar: { enabled }
                        }
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Background Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Background
              </h3>
            </div>
            <div className="space-y-3 pl-4">
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
                    className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 w-8">
                    {settings.config.background.opacity}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Show Only When On Track Settings */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">
                Show Only When On Track
              </h4>
              <p className="text-sm text-slate-400">
                If enabled, standings will only be shown when you are driving.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack ?? false}
              onToggle={(enabled) =>
                handleConfigChange({ showOnlyWhenOnTrack: enabled })
              }
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
