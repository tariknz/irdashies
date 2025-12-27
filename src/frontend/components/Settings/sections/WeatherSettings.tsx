import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
// sortable list is not used right now — keep import commented until needed
// import { useSortableList } from '../../SortableList';

const SETTING_ID = 'weather';

const defaultConfig: WeatherWidgetSettings['config'] = {
  background: { opacity: 0 },
  airTemp: { enabled: true },
  trackTemp: { enabled: true },
  wetness: { enabled: true },
  trackState: { enabled: true },
  wind: { enabled: true },
  units: 'auto',
};

const migrateConfig = (savedConfig: unknown): WeatherWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? defaultConfig.background.opacity },
    airTemp: { enabled: (config.airTemp as { enabled?: boolean })?.enabled ?? defaultConfig.airTemp.enabled },
    trackTemp: { enabled: (config.trackTemp as { enabled?: boolean })?.enabled ?? defaultConfig.trackTemp.enabled },
    wetness: { enabled: (config.wetness as { enabled?: boolean })?.enabled ?? defaultConfig.wetness.enabled },
    trackState: { enabled: (config.trackState as { enabled?: boolean })?.enabled ?? defaultConfig.trackState.enabled },
    wind: { enabled: (config.wind as { enabled?: boolean })?.enabled ?? defaultConfig.wind.enabled },
    units: (config.units as 'auto' | 'Metric' | 'Imperial') ?? 'auto',
  };
};

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const config = settings.config;



  // Render settings using the BaseSettingsSection helper.
  // Children is provided as a function which receives `handleConfigChange`.
  return (
    <BaseSettingsSection
      title="Weather"
      description="Show weather related readings (air/track temperature, wind, wetness, track state)."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Background Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.config.background.opacity}
                onChange={(e) =>
                  handleConfigChange({ background: { opacity: parseInt(e.target.value) } })
                }
                className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-slate-400 w-8">
                {settings.config.background.opacity}%
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-200">Track Temperature</h3>
              <p className="text-sm text-slate-400">Show the current track surface temperature.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.trackTemp.enabled}
              onToggle={(enabled) => handleConfigChange({ trackTemp: { enabled } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Air Temperature</h3>
              <p className="text-sm text-slate-400">Show ambient air temperature.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.airTemp.enabled}
              onToggle={(enabled) => handleConfigChange({ airTemp: { enabled } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Wind</h3>
              <p className="text-sm text-slate-400">Show wind speed/direction if available.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.wind.enabled}
              onToggle={(enabled) => handleConfigChange({ wind: { enabled } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Wetness</h3>
              <p className="text-sm text-slate-400">Show track wetness / moisture level.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.wetness.enabled}
              onToggle={(enabled) => handleConfigChange({ wetness: { enabled } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Track State</h3>
              <p className="text-sm text-slate-400">Show track state (dry/wet/unknown).</p>
            </div>
            <ToggleSwitch
              enabled={!!config.trackState.enabled}
              onToggle={(enabled) => handleConfigChange({ trackState: { enabled } })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Temperature Units</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfigChange({ units: 'auto' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.units === 'auto'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
              >
                auto
              </button>
              <button
                onClick={() => handleConfigChange({ units: 'Metric' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.units === 'Metric'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
              >
                °C
              </button>
              <button
                onClick={() => handleConfigChange({ units: 'Imperial' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.units === 'Imperial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
              >
                °F
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};