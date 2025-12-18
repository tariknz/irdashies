import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard, useRelativeGapStore } from '@irdashies/context';
import { RelativeWidgetSettings } from '../types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useSortableList } from '../../SortableList';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';

const SETTING_ID = 'relative';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof RelativeWidgetSettings['config'];
  hasSubSetting?: boolean;
}

const sortableSettings: SortableSetting[] = [
  { id: 'position', label: 'Position', configKey: 'position' },
  { id: 'carNumber', label: 'Car Number', configKey: 'carNumber' },
  { id: 'countryFlags', label: 'Country Flags', configKey: 'countryFlags' },
  { id: 'driverName', label: 'Driver Name', configKey: 'driverName' },
  { id: 'pitStatus', label: 'Pit Status', configKey: 'pitStatus' },
  { id: 'carManufacturer', label: 'Car Manufacturer', configKey: 'carManufacturer' },
  { id: 'badge', label: 'Driver Badge', configKey: 'badge' },
  { id: 'iratingChange', label: 'iRating Change', configKey: 'iratingChange' },
  { id: 'delta', label: 'Relative', configKey: 'delta' },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
];

const defaultConfig: RelativeWidgetSettings['config'] = {
  buffer: 3,
  background: { opacity: 0 },
  position: { enabled: true },
  carNumber: { enabled: true },
  countryFlags: { enabled: true },
  driverName: { enabled: true },
  pitStatus: { enabled: true },
  carManufacturer: { enabled: true },
  badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
  iratingChange: { enabled: false },
  delta: { enabled: true },
  fastestTime: { enabled: false, timeFormat: 'full' },
  lastTime: { enabled: false, timeFormat: 'full' },
  compound: { enabled: false },
  displayOrder: sortableSettings.map(s => s.id),
  enhancedGapCalculation: {
    enabled: true,
    interpolationMethod: 'linear',
    sampleInterval: 0.01,
    maxLapHistory: 5,
  },
  titleBar: { enabled: true, progressBar: { enabled: true } },
  headerBar: {
    enabled: true,
    sessionName: { enabled: true },
    timeRemaining: { enabled: true },
    incidentCount: { enabled: true },
    brakeBias: { enabled: true },
    localTime: { enabled: false },
    trackWetness: { enabled: false },
    airTemperature: { enabled: false, unit: 'Metric' },
    trackTemperature: { enabled: false, unit: 'Metric' },
    displayOrder: ['sessionName', 'timeRemaining', 'brakeBias', 'incidentCount', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
  },
  footerBar: {
    enabled: true,
    sessionName: { enabled: false },
    timeRemaining: { enabled: false },
    incidentCount: { enabled: false },
    brakeBias: { enabled: false },
    localTime: { enabled: true },
    trackWetness: { enabled: true },
    airTemperature: { enabled: true, unit: 'Metric' },
    trackTemperature: { enabled: true, unit: 'Metric' },
    displayOrder: ['sessionName', 'timeRemaining', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
  },
  showOnlyWhenOnTrack: false
};

const mergeDisplayOrder = (existingOrder?: string[]): string[] => {
  if (!existingOrder) return defaultConfig.displayOrder;

  const allIds = sortableSettings.map(s => s.id);
  const merged = [...existingOrder];

  const missingIds = allIds.filter(id => !merged.includes(id));

  missingIds.forEach(missingId => {
    const missingIndex = allIds.indexOf(missingId);

    let insertIndex = merged.length;

    for (let i = missingIndex + 1; i < allIds.length; i++) {
      const existingItem = allIds[i];
      const existingItemIndex = merged.indexOf(existingItem);
      if (existingItemIndex !== -1) {
        insertIndex = existingItemIndex;
        break;
      }
    }

    merged.splice(insertIndex, 0, missingId);
  });

  return merged;
};

const migrateConfig = (savedConfig: unknown): RelativeWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  const enhancedGap = config.enhancedGapCalculation as { enabled?: boolean; interpolationMethod?: 'linear' | 'cubic'; sampleInterval?: number; maxLapHistory?: number } | undefined;
  return {
    buffer: (config.buffer as number) ?? 3,
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? 0 },
    position: { enabled: (config.position as { enabled?: boolean })?.enabled ?? true },
    carNumber: { enabled: (config.carNumber as { enabled?: boolean })?.enabled ?? true },
    countryFlags: { enabled: (config.countryFlags as { enabled?: boolean })?.enabled ?? true },
    driverName: { enabled: (config.driverName as { enabled?: boolean })?.enabled ?? true },
    pitStatus: { enabled: (config.pitStatus as { enabled?: boolean })?.enabled ?? true },
    carManufacturer: { enabled: (config.carManufacturer as { enabled?: boolean })?.enabled ?? true },
    badge: {
      enabled: (config.badge as { enabled?: boolean })?.enabled ?? true,
      badgeFormat: ((config.badge as { badgeFormat?: string })?.badgeFormat as 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license') ?? 'license-color-rating-bw'
    },
    iratingChange: { enabled: (config.iratingChange as { enabled?: boolean })?.enabled ?? false },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    fastestTime: { enabled: (config.fastestTime as { enabled?: boolean; timeFormat?: string })?.enabled ?? false, timeFormat: ((config.fastestTime as { enabled?: boolean; timeFormat?: string })?.timeFormat as 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds') ?? 'full' },
    lastTime: { enabled: (config.lastTime as { enabled?: boolean; timeFormat?: string })?.enabled ?? false, timeFormat: ((config.lastTime as { enabled?: boolean; timeFormat?: string })?.timeFormat as 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds') ?? 'full' },
    compound: { enabled: (config.compound as { enabled?: boolean })?.enabled ?? false },
    displayOrder: mergeDisplayOrder(config.displayOrder as string[]),
    enhancedGapCalculation: {
      enabled: enhancedGap?.enabled ?? true,
      interpolationMethod: enhancedGap?.interpolationMethod ?? 'linear',
      sampleInterval: enhancedGap?.sampleInterval ?? 0.01,
      maxLapHistory: enhancedGap?.maxLapHistory ?? 5,
    },
    titleBar: {
      enabled: (config.titleBar as { enabled?: boolean })?.enabled ?? true,
      progressBar: {
        enabled: (config.titleBar as { progressBar?: { enabled?: boolean } })?.progressBar?.enabled ?? true
      }
    },
    headerBar: {
      enabled: (config.headerBar as { enabled?: boolean })?.enabled ?? true,
      sessionName: { enabled: (config.headerBar as { sessionName?: { enabled?: boolean } })?.sessionName?.enabled ?? true },
      timeRemaining: { enabled: (config.headerBar as { timeRemaining?: { enabled?: boolean } })?.timeRemaining?.enabled ?? true },
      incidentCount: { enabled: (config.headerBar as { incidentCount?: { enabled?: boolean } })?.incidentCount?.enabled ?? true },
      brakeBias: { enabled: (config.headerBar as { brakeBias?: { enabled?: boolean } })?.brakeBias?.enabled ?? false },
      localTime: { enabled: (config.headerBar as { localTime?: { enabled?: boolean } })?.localTime?.enabled ?? false },
      trackWetness: { enabled: (config.headerBar as { trackWetness?: { enabled?: boolean } })?.trackWetness?.enabled ?? false },
      airTemperature: {
        enabled: (config.headerBar as { airTemperature?: { enabled?: boolean; unit?: string } })?.airTemperature?.enabled ?? false,
        unit: ((config.headerBar as { airTemperature?: { unit?: string } })?.airTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric'
      },
      trackTemperature: {
        enabled: (config.headerBar as { trackTemperature?: { enabled?: boolean; unit?: string } })?.trackTemperature?.enabled ?? false,
        unit: ((config.headerBar as { trackTemperature?: { unit?: string } })?.trackTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric'
      },
      displayOrder: (config.headerBar as { displayOrder?: string[] })?.displayOrder ?? ['sessionName', 'timeRemaining', 'brakeBias', 'incidentCount', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
    },
    footerBar: {
      enabled: (config.footerBar as { enabled?: boolean })?.enabled ?? true,
      sessionName: { enabled: (config.footerBar as { sessionName?: { enabled?: boolean } })?.sessionName?.enabled ?? false },
      timeRemaining: { enabled: (config.footerBar as { timeRemaining?: { enabled?: boolean } })?.timeRemaining?.enabled ?? false },
      incidentCount: { enabled: (config.footerBar as { incidentCount?: { enabled?: boolean } })?.incidentCount?.enabled ?? false },
      brakeBias: { enabled: (config.footerBar as { brakeBias?: { enabled?: boolean } })?.brakeBias?.enabled ?? false },
      localTime: { enabled: (config.footerBar as { localTime?: { enabled?: boolean } })?.localTime?.enabled ?? true },
      trackWetness: { enabled: (config.footerBar as { trackWetness?: { enabled?: boolean } })?.trackWetness?.enabled ?? true },
      airTemperature: {
        enabled: (config.footerBar as { airTemperature?: { enabled?: boolean; unit?: string } })?.airTemperature?.enabled ?? true,
        unit: ((config.footerBar as { airTemperature?: { unit?: string } })?.airTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric'
      },
      trackTemperature: {
        enabled: (config.footerBar as { trackTemperature?: { enabled?: boolean; unit?: string } })?.trackTemperature?.enabled ?? true,
        unit: ((config.footerBar as { trackTemperature?: { unit?: string } })?.trackTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric'
      },
      displayOrder: (config.footerBar as { displayOrder?: string[] })?.displayOrder ?? ['sessionName', 'timeRemaining', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
    },
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? false
  };
};

const barItemLabels: Record<string, string> = {
  sessionName: 'Session Name',
  timeRemaining: 'Time Remaining',
  incidentCount: 'Incident Count',
  brakeBias: 'Brake Bias',
  localTime: 'Local Time',
  trackWetness: 'Track Wetness',
  airTemperature: 'Air Temperature',
  trackTemperature: 'Track Temperature'
};

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: RelativeWidgetSettings;
  handleConfigChange: (changes: Partial<RelativeWidgetSettings['config']>) => void;
}

const DisplaySettingsList = ({ itemsOrder, onReorder, settings, handleConfigChange }: DisplaySettingsListProps) => {
  const items = itemsOrder.map(id => {
    const setting = sortableSettings.find(s => s.id === id);
    return setting ? { ...setting } : null;
  }).filter((s): s is SortableSetting => s !== null);

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems) => onReorder(newItems.map(i => i.id)),
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
                  const cv = settings.config[setting.configKey] as { enabled: boolean; [key: string]: unknown };
                  handleConfigChange({
                    [setting.configKey]: { ...cv, enabled }
                  });
                }}
              />
            </div>
            {setting.configKey === 'badge' && (configValue as { enabled: boolean }).enabled && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-3 justify-end">
                  {(['license-color-rating-bw', 'rating-only-color-rating-bw', 'license-color-rating-bw-no-license', 'rating-color-no-license', 'license-bw-rating-bw', 'rating-only-bw-rating-bw', 'license-bw-rating-bw-no-license', 'rating-bw-no-license'] as const).map((format) => (
                    <BadgeFormatPreview
                      key={format}
                      format={format}
                      selected={(configValue as { enabled: boolean; badgeFormat: string }).badgeFormat === format}
                      onClick={() => {
                        const cv = settings.config[setting.configKey] as { enabled: boolean; badgeFormat: string; [key: string]: unknown };
                        handleConfigChange({
                          [setting.configKey]: { ...cv, badgeFormat: format },
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {(setting.configKey === 'fastestTime' || setting.configKey === 'lastTime') && (configValue as { enabled: boolean }).enabled && (
              <div className="flex items-center justify-between pl-8 mt-2">
                <span className="text-sm text-slate-300"></span>
                <select
                  value={(configValue as { enabled: boolean; timeFormat: string }).timeFormat}
                  onChange={(e) => {
                    const cv = settings.config[setting.configKey] as { enabled: boolean; timeFormat: string; [key: string]: unknown };
                    handleConfigChange({
                      [setting.configKey]: {
                        ...cv,
                        timeFormat: e.target.value as 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds'
                      },
                    });
                  }}
                  className="w-26 bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="full">1:42.123</option>
                  <option value="mixed">1:42.1</option>
                  <option value="minutes">1:42</option>
                  <option value="seconds-full">42.123</option>
                  <option value="seconds-mixed">42.1</option>
                  <option value="seconds">42</option>
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface BarItemsListProps {
  items: string[];
  onReorder: (newOrder: string[]) => void;
  barType: 'headerBar' | 'footerBar';
  settings: RelativeWidgetSettings;
  handleConfigChange: (changes: Partial<RelativeWidgetSettings['config']>) => void;
}

const BarItemsList = ({ items, onReorder, barType, settings, handleConfigChange }: BarItemsListProps) => {
  const wrappedItems = items.map(id => ({ id }));

  const { getItemProps, displayItems } = useSortableList({
    items: wrappedItems,
    onReorder: (newItems) => onReorder(newItems.map(i => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-3 pl-4">
      {displayItems.map((item) => {
        const { dragHandleProps, itemProps } = getItemProps(item);
        const itemConfig = (settings.config[barType] as RelativeWidgetSettings['config']['headerBar'])?.[item.id as keyof RelativeWidgetSettings['config']['headerBar']] as { enabled: boolean; unit?: 'Metric' | 'Imperial' } | { enabled: boolean } | undefined;

        return (
          <div key={item.id} {...itemProps}>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...dragHandleProps}
                  className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
                >
                  <DotsSixVerticalIcon size={16} className="text-slate-400" />
                </div>
                <span className="text-sm text-slate-300">{barItemLabels[item.id]}</span>
              </div>
              <ToggleSwitch
                enabled={itemConfig?.enabled ?? true}
                onToggle={(enabled) => {
                  const currentUnit = (itemConfig && 'unit' in itemConfig) ? itemConfig.unit : 'Metric';
                  handleConfigChange({
                    [barType]: {
                      ...settings.config[barType],
                      [item.id]: (item.id === 'airTemperature' || item.id === 'trackTemperature')
                        ? { enabled, unit: currentUnit }
                        : { enabled }
                    }
                  });
                }}
              />
            </div>
            {(item.id === 'airTemperature' || item.id === 'trackTemperature') && itemConfig && 'enabled' in itemConfig && itemConfig.enabled && (
              <div className="flex items-center justify-between pl-8 mt-2">
                <span></span>
                <select
                  value={(itemConfig && 'unit' in itemConfig) ? itemConfig.unit : 'Metric'}
                  onChange={(e) => {
                    handleConfigChange({
                      [barType]: {
                        ...settings.config[barType],
                        [item.id]: {
                          enabled: itemConfig && 'enabled' in itemConfig ? itemConfig.enabled : true,
                          unit: e.target.value as 'Metric' | 'Imperial'
                        }
                      }
                    });
                  }}
                  className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="Metric">°C</option>
                  <option value="Imperial">°F</option>
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  const updateStoreConfig = useRelativeGapStore((state) => state.updateConfig);

  useEffect(() => {
    const config = settings.config.enhancedGapCalculation;
    updateStoreConfig({
      enabled: config.enabled,
      interpolationMethod: config.interpolationMethod,
      sampleInterval: config.sampleInterval,
      maxLapHistory: config.maxLapHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {(handleConfigChange) => {
        const handleDisplayOrderChange = (newOrder: string[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };

        return (
          <div className="space-y-8">
            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Display Settings</h3>
                <button
                  onClick={() => {
                    const defaultOrder = sortableSettings.map(s => s.id);
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

            {/* Driver Standings Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Driver Standings</h3>
              </div>
              <div className="space-y-3 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Drivers to show around player</span>
                  <select
                    value={settings.config.buffer}
                    onChange={(e) =>
                      handleConfigChange({ buffer: parseInt(e.target.value) })
                    }
                    className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
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

            {/* Header Bar Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Header Bar</h3>
                <button
                  onClick={() => {
                    const defaultOrder = ['sessionName', 'timeRemaining', 'brakeBias', 'incidentCount', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature'];
                    handleConfigChange({
                      headerBar: {
                        ...settings.config.headerBar,
                        displayOrder: defaultOrder
                      }
                    });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="space-y-3 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Show Header Bar</span>
                  <ToggleSwitch
                    enabled={settings.config.headerBar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        headerBar: {
                          ...settings.config.headerBar,
                          enabled
                        }
                      })
                    }
                  />
                </div>
                {settings.config.headerBar.enabled && (
                  <BarItemsList
                    items={settings.config.headerBar.displayOrder}
                    onReorder={(newOrder) => {
                      handleConfigChange({
                        headerBar: {
                          ...settings.config.headerBar,
                          displayOrder: newOrder
                        }
                      });
                    }}
                    barType="headerBar"
                    settings={settings}
                    handleConfigChange={handleConfigChange}
                  />
                )}
              </div>
            </div>

            {/* Footer Bar Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Footer Bar</h3>
                <button
                  onClick={() => {
                    const defaultOrder = ['sessionName', 'timeRemaining', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature'];
                    handleConfigChange({
                      footerBar: {
                        ...settings.config.footerBar,
                        displayOrder: defaultOrder
                      }
                    });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="space-y-3 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Show Footer Bar</span>
                  <ToggleSwitch
                    enabled={settings.config.footerBar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        footerBar: {
                          ...settings.config.footerBar,
                          enabled
                        }
                      })
                    }
                  />
                </div>
                {settings.config.footerBar.enabled && (
                  <BarItemsList
                    items={settings.config.footerBar.displayOrder}
                    onReorder={(newOrder) => {
                      handleConfigChange({
                        footerBar: {
                          ...settings.config.footerBar,
                          displayOrder: newOrder
                        }
                      });
                    }}
                    barType="footerBar"
                    settings={settings}
                    handleConfigChange={handleConfigChange}
                  />
                )}
              </div>
            </div>

            {/* Background Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Background</h3>
              </div>
              <div className="space-y-3 pl-4">
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
              </div>
            </div>

            {/* Enhanced Gap Calculation Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Enhanced Gap Calculation</h3>
              </div>
              <div className="space-y-3 px-4">
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    Uses position/time records for accurate multi-class gaps instead of simple distance-based estimates
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-300">Enable Enhanced Calculation</span>
                    <p className="text-xs text-slate-400">Uses lap data interpolation for accuracy</p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.enhancedGapCalculation.enabled}
                    onToggle={(enabled) => {
                      const newConfig = {
                        ...settings.config.enhancedGapCalculation,
                        enabled,
                      };
                      handleConfigChange({
                        enhancedGapCalculation: newConfig,
                      });
                      updateStoreConfig(newConfig);
                    }}
                  />
                </div>

                {settings.config.enhancedGapCalculation.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">Interpolation Method</span>
                        <p className="text-xs text-slate-400">Linear is more stable, cubic is smoother</p>
                      </div>
                      <select
                        value={settings.config.enhancedGapCalculation.interpolationMethod}
                        onChange={(e) => {
                          const newConfig = {
                            ...settings.config.enhancedGapCalculation,
                            interpolationMethod: e.target.value as 'linear' | 'cubic',
                          };
                          handleConfigChange({
                            enhancedGapCalculation: newConfig,
                          });
                          updateStoreConfig(newConfig);
                        }}
                        className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="linear">Linear</option>
                        <option value="cubic">Cubic Spline</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">Max Lap History</span>
                        <p className="text-xs text-slate-400">Number of recent laps to keep for each car</p>
                      </div>
                      <select
                        value={settings.config.enhancedGapCalculation.maxLapHistory}
                        onChange={(e) => {
                          const newConfig = {
                            ...settings.config.enhancedGapCalculation,
                            maxLapHistory: parseInt(e.target.value),
                          };
                          handleConfigChange({
                            enhancedGapCalculation: newConfig,
                          });
                          updateStoreConfig(newConfig);
                        }}
                        className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                      >
                        {[3, 5, 7, 10].map((num) => (
                          <option key={num} value={num}>
                            {num} laps
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Show Only When On Track Settings */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-medium text-slate-300">Show Only When On Track</h4>
                <p className="text-sm text-slate-400">
                  If enabled, relatives will only be shown when you are driving.
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
        );
      }}
    </BaseSettingsSection>
  );
};
