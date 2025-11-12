import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings } from '../types';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'relative';

const defaultConfig: RelativeWidgetSettings['config'] = {
  buffer: 3,
  background: { opacity: 0 },
  countryFlags: { enabled: true },
  carNumber: { enabled: true },
  lastTime: { enabled: false },
  fastestTime: { enabled: false },
  compound: { enabled: false },
  carManufacturer: { enabled: true },
  brakeBias: { enabled: false }
};

const migrateConfig = (savedConfig: unknown): RelativeWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    buffer: (config.buffer as { value?: number })?.value ?? 3,
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? 0 },
    countryFlags: { enabled: (config.countryFlags as { enabled?: boolean })?.enabled ?? true },
    carNumber: { enabled: (config.carNumber as { enabled?: boolean })?.enabled ?? true },
    lastTime: { enabled: (config.lastTime as { enabled?: boolean })?.enabled ?? false },
    fastestTime: { enabled: (config.fastestTime as { enabled?: boolean })?.enabled ?? false },
    compound: { enabled: (config.compound as { enabled?: boolean })?.enabled ?? false },
    carManufacturer: { enabled: (config.carManufacturer as { enabled?: boolean })?.enabled ?? false },
    brakeBias: { enabled: (config.brakeBias as { enabled?: boolean })?.enabled ?? false },
  };
};

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RelativeWidgetSettings | undefined;
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Relative Settings"
      description="Configure the relative timing display settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="relative"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Buffer Size</span>
              <p className="text-xs text-slate-400">
                Number of drivers to show above and below the player
              </p>
            </div>
            <select
              value={settings.config.buffer}
              onChange={(e) =>
                handleConfigChange({ buffer: parseInt(e.target.value) })
              }
              className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
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
            <span className="text-sm text-slate-300">Show Last Time</span>
            <ToggleSwitch
              enabled={settings.config.lastTime.enabled}
              onToggle={(enabled) =>
                handleConfigChange({ lastTime: { enabled } })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Show Best Time</span>
            <ToggleSwitch
              enabled={settings.config.fastestTime.enabled}
              onToggle={(enabled) =>
                handleConfigChange({ fastestTime: { enabled } })
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
            <span className="text-sm text-slate-300">Show Brake Bias</span>
            <ToggleSwitch
              enabled={settings.config.brakeBias.enabled}
              onToggle={(enabled) =>
                handleConfigChange({ brakeBias: { enabled } })
              }
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
