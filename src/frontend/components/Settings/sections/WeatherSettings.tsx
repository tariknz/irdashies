import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { mergeDisplayOrder } from '@irdashies/utils/displayOrder';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useSortableList } from '../../SortableList';
// sortable list is not used right now — keep import commented until needed
// import { useSortableList } from '../../SortableList';

const SETTING_ID = 'weather';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof WeatherWidgetSettings['config'];
}

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: WeatherWidgetSettings;
  handleConfigChange: (changes: Partial<WeatherWidgetSettings['config']>) => void;
}


const sortableSettings: SortableSetting[] = [
  { id: 'trackTemp', label: 'Track Temperature', configKey: 'trackTemp' },
  { id: 'airTemp', label: 'Air Temperature', configKey: 'airTemp' },
  { id: 'wind', label: 'Wind', configKey: 'wind' },
  { id: 'humidity', label: 'Humidity', configKey: 'humidity' },
  { id: 'wetness', label: 'Wetness', configKey: 'wetness' },
  { id: 'trackState', label: 'Track State', configKey: 'trackState' },
]


const defaultConfig: WeatherWidgetSettings['config'] = {
  displayOrder: sortableSettings.map((s) => s.id),
  background: { opacity: 0 },
  airTemp: { enabled: true },
  trackTemp: { enabled: true },
  wetness: { enabled: true },
  trackState: { enabled: true },
  wind: { enabled: true },
  units: 'auto',
  humidity: {
    enabled: true
  }
};

const migrateConfig = (savedConfig: unknown): WeatherWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? defaultConfig.background.opacity },
    displayOrder: mergeDisplayOrder(sortableSettings.map((s) => s.id), config.displayOrder as string[]),
    airTemp: { enabled: (config.airTemp as { enabled?: boolean })?.enabled ?? defaultConfig.airTemp.enabled },
    trackTemp: { enabled: (config.trackTemp as { enabled?: boolean })?.enabled ?? defaultConfig.trackTemp.enabled },
    wetness: { enabled: (config.wetness as { enabled?: boolean })?.enabled ?? defaultConfig.wetness.enabled },
    trackState: { enabled: (config.trackState as { enabled?: boolean })?.enabled ?? defaultConfig.trackState.enabled },
    humidity: { enabled: (config.humidity as { enabled?: boolean })?.enabled ?? defaultConfig.humidity.enabled },
    wind: { enabled: (config.wind as { enabled?: boolean })?.enabled ?? defaultConfig.wind.enabled },
    units: (config.units as 'auto' | 'Metric' | 'Imperial') ?? 'auto',
  };
};

const DisplaySettingsList = ({ itemsOrder, onReorder, settings, handleConfigChange }: DisplaySettingsListProps) => {
  const items = itemsOrder
    .map((id) => {
      const setting = sortableSettings.find((s) => s.id === id);
      return setting ? { ...setting } : null;
    })
    .filter((s): s is SortableSetting => s !== null);

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-3">
      {displayItems.map((setting) => {
        const { dragHandleProps, itemProps } = getItemProps(setting);
        const configValue = settings.config[setting.configKey];
        const isEnabled = (configValue as { enabled: boolean }).enabled;

        return (
          <div key={setting.id} {...itemProps}>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...dragHandleProps}
                  className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
                >
                  <DotsSixVerticalIcon size={16} className="text-slate-400" />
                </div>
                <span className="text-sm text-slate-300">{setting.label}</span>
              </div>
              <ToggleSwitch
                enabled={isEnabled}
                onToggle={(enabled) => {
                  const cv = settings.config[setting.configKey] as { enabled: boolean;[key: string]: unknown };
                  handleConfigChange({
                    [setting.configKey]: { ...cv, enabled },
                  });
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
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

  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

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
      {(handleConfigChange) => {
        const handleDisplayOrderChange = (newOrder: string[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };


        return (
          <div className="space-y-4">
            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Display</h3>
                <button
                  onClick={() => {
                    const defaultOrder = sortableSettings.map((s) => s.id);
                    setItemsOrder(defaultOrder);
                    handleConfigChange({ displayOrder: defaultOrder });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="px-4">
                <DisplaySettingsList
                  itemsOrder={itemsOrder}
                  onReorder={handleDisplayOrderChange}
                  settings={settings}
                  handleConfigChange={handleConfigChange}
                />
              </div>
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
                    handleConfigChange({ background: { opacity: parseInt(e.target.value) } })
                  }
                  className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400 w-8">
                  {settings.config.background.opacity}%
                </span>
              </div>
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
        );
      }}
    </BaseSettingsSection>
  );
};