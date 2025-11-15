import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FuelWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'fuel';

const defaultConfig: FuelWidgetSettings['config'] = {
  fuelUnits: 'L',
  showConsumption: true,
  showMin: true,
  showLastLap: true,
  show3LapAvg: true,
  show10LapAvg: true,
  showMax: true,
  showPitWindow: true,
  showFuelSave: true,
  safetyMargin: 0.05,
  background: { opacity: 85 },
};

const migrateConfig = (
  savedConfig: unknown
): FuelWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    fuelUnits: (config.fuelUnits as 'L' | 'gal') ?? 'L',
    showConsumption: (config.showConsumption as boolean) ?? true,
    showMin: (config.showMin as boolean) ?? true,
    showLastLap: (config.showLastLap as boolean) ?? true,
    show3LapAvg: (config.show3LapAvg as boolean) ?? true,
    show10LapAvg: (config.show10LapAvg as boolean) ?? true,
    showMax: (config.showMax as boolean) ?? true,
    showPitWindow: (config.showPitWindow as boolean) ?? true,
    showFuelSave: (config.showFuelSave as boolean) ?? true,
    safetyMargin: (config.safetyMargin as number) ?? 0.05,
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ?? 85,
    },
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

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Fuel Calculator Settings"
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
                <span className="text-xs text-slate-400">
                  Show Min
                </span>
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
                <span className="text-xs text-slate-400">
                  Show Last Lap
                </span>
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
                <span className="text-xs text-slate-400">
                  Show Max
                </span>
                <input
                  type="checkbox"
                  checked={settings.config.showMax}
                  onChange={(e) =>
                    handleConfigChange({ showMax: e.target.checked })
                  }
                  className="w-4 h-4 bg-slate-700 rounded"
                />
              </div>
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

          {/* Show Fuel Save Indicator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Show Fuel Save Indicator
            </span>
            <input
              type="checkbox"
              checked={settings.config.showFuelSave}
              onChange={(e) =>
                handleConfigChange({ showFuelSave: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 rounded"
            />
          </div>

          {/* Safety Margin */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Safety Margin
              <span className="block text-xs text-slate-500">
                Extra fuel buffer for calculations
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
      )}
    </BaseSettingsSection>
  );
};
