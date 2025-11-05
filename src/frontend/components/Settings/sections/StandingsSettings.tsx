import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ColumnReorderList } from '../components/ColumnReorderList';
import {
  DEFAULT_STANDINGS_COLUMN_ORDER,
  COLUMN_METADATA,
  type ColumnId,
} from '../../Standings/types/columns';

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
  columnOrder: DEFAULT_STANDINGS_COLUMN_ORDER,
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
    columnOrder: (config.columnOrder as string[]) ?? DEFAULT_STANDINGS_COLUMN_ORDER,
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
                <span className="text-sm text-slate-300">iRating Changes</span>
                <ToggleSwitch
                  enabled={settings.config.iRatingChange.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ iRatingChange: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Driver Badge</span>
                <ToggleSwitch
                  enabled={settings.config.badge.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ badge: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Delta</span>
                <ToggleSwitch
                  enabled={settings.config.delta.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ delta: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Last Time</span>
                <ToggleSwitch
                  enabled={settings.config.lastTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ lastTime: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Fastest Time</span>
                <ToggleSwitch
                  enabled={settings.config.fastestTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ fastestTime: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Car Number</span>
                <ToggleSwitch
                  enabled={settings.config.carNumber.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ carNumber: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Country Flags</span>
                <ToggleSwitch
                  enabled={settings.config.countryFlags.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ countryFlags: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Tire Compound</span>
                <ToggleSwitch
                  enabled={settings.config.compound.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ compound: { enabled } })
                  }
                />
              </div>
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

          {/* Column Order Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Column Order
              </h3>
            </div>
            <div className="space-y-3 pl-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Drag and drop to reorder columns
                </p>
                <ColumnReorderList
                  columns={settings.config.columnOrder || DEFAULT_STANDINGS_COLUMN_ORDER}
                  onChange={(newOrder) => handleConfigChange({ columnOrder: newOrder })}
                  getDisplayName={(columnId) => COLUMN_METADATA[columnId as ColumnId]?.displayName || columnId}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
}; 
