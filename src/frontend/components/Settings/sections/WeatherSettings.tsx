import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
// sortable list is not used right now — keep import commented until needed
// import { useSortableList } from '../../SortableList';

const SETTING_ID = 'weather';

const defaultConfig: WeatherWidgetSettings['config'] = {
  background: { opacity: 0 },
  includeAirTemp: true,
  includeTrackTemp: true,
  includeWind: false,
  includeWetness: false,
  includeTrackState: false,
  units: 'auto',
};

const migrateConfig = (savedConfig: unknown): WeatherWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? defaultConfig.background.opacity },
    includeAirTemp: typeof config.includeAirTemp === 'boolean' ? (config.includeAirTemp as boolean) : defaultConfig.includeAirTemp,
    includeTrackTemp: typeof config.includeTrackTemp === 'boolean' ? (config.includeTrackTemp as boolean) : defaultConfig.includeTrackTemp,
    includeWind: typeof config.includeWind === 'boolean' ? (config.includeWind as boolean) : defaultConfig.includeWind,
    includeWetness: typeof config.includeWetness === 'boolean' ? (config.includeWetness as boolean) : defaultConfig.includeWetness,
    includeTrackState: typeof config.includeTrackState === 'boolean' ? (config.includeTrackState as boolean) : defaultConfig.includeTrackState,
    units: (config.units as 'auto' | 'Metric' | 'Imperial') ?? 'auto',
  };
};

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: WeatherWidgetSettings;
  handleConfigChange: (changes: Partial<WeatherWidgetSettings['config']>) => void;
}

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof WeatherWidgetSettings['config'];
}

const sortableSettings: SortableSetting[] = [
  { id: 'trace', label: 'Trace', configKey: 'includeTrackTemp' },
  { id: 'airTemp', label: 'Air Temperature', configKey: 'includeAirTemp' },
  { id: 'wind', label: 'Wind', configKey: 'includeWind' },
  { id: 'wetness', label: 'Wetness', configKey: 'includeWetness' },
  { id: 'trackState', label: 'Track State', configKey: 'includeTrackState' },
];

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  // Keep local state in sync when dashboard updates elsewhere
  useEffect(() => {
    const s = currentDashboard?.widgets.find((w) => w.id === SETTING_ID) as WeatherWidgetSettings | undefined;
    setSettings({
      enabled: s?.enabled ?? false,
      config: migrateConfig(s?.config),
    });
  }, [currentDashboard]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const config = settings.config;



  // Render settings using the BaseSettingsSection helper.
  // Children is provided as a function which receives `handleConfigChange`.
  return (
    <BaseSettingsSection
      title="Weather"
      description="Show weather-related readings (air/track temperature, wind, wetness, track state)."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Track Temperature</h3>
              <p className="text-sm text-slate-400">Show the current track surface temperature.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.includeTrackTemp}
              onToggle={(enabled) => handleConfigChange({ includeTrackTemp: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Air Temperature</h3>
              <p className="text-sm text-slate-400">Show ambient air temperature.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.includeAirTemp}
              onToggle={(enabled) => handleConfigChange({ includeAirTemp: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Wind</h3>
              <p className="text-sm text-slate-400">Show wind speed/direction if available.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.includeWind}
              onToggle={(enabled) => handleConfigChange({ includeWind: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Wetness</h3>
              <p className="text-sm text-slate-400">Show track wetness / moisture level.</p>
            </div>
            <ToggleSwitch
              enabled={!!config.includeWetness}
              onToggle={(enabled) => handleConfigChange({ includeWetness: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Track State</h3>
              <p className="text-sm text-slate-400">Show track state (dry/wet/unknown).</p>
            </div>
            <ToggleSwitch
              enabled={!!config.includeTrackState}
              onToggle={(enabled) => handleConfigChange({ includeTrackState: enabled })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Temperature Units</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfigChange({ units: 'auto' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.units === 'auto'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                auto
              </button>
              <button
                onClick={() => handleConfigChange({ units: 'Metric' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.units === 'Metric'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                °C
              </button>
              <button
                onClick={() => handleConfigChange({ units: 'Imperial' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.units === 'Imperial'
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