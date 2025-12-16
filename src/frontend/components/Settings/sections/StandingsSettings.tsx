import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useSortableList } from '../../SortableList';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';

const SETTING_ID = 'standings';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof StandingsWidgetSettings['config'];
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
  { id: 'gap', label: 'Gap', configKey: 'gap' },
  { id: 'interval', label: 'Interval', configKey: 'interval' },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
  { id: 'lapTimeDeltas', label: 'Lap Time Deltas', configKey: 'lapTimeDeltas', hasSubSetting: true },
];

const defaultConfig: StandingsWidgetSettings['config'] = {
  iratingChange: { enabled: true },
  badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
  delta: { enabled: true },
  gap: { enabled: false },
  interval: { enabled: false },
  lastTime: { enabled: true, timeFormat: 'full' },
  fastestTime: { enabled: true, timeFormat: 'full' },
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
  titleBar: { enabled: true, progressBar: { enabled: true } },
  headerBar: {
    enabled: true,
    sessionName: { enabled: true },
    timeRemaining: { enabled: true },
    incidentCount: { enabled: true },
    brakeBias: { enabled: false },
    localTime: { enabled: false },
    trackWetness: { enabled: false },
    airTemperature: { enabled: false },
    trackTemperature: { enabled: false },
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
    airTemperature: { enabled: true },
    trackTemperature: { enabled: true },
    displayOrder: ['sessionName', 'timeRemaining', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
  },
  showOnlyWhenOnTrack: false,
  lapTimeDeltas: { enabled: false, numLaps: 3 },
  position: { enabled: true },
  driverName: { enabled: true },
  pitStatus: { enabled: true },
  displayOrder: sortableSettings.map(s => s.id)
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

const migrateConfig = (
  savedConfig: unknown
): StandingsWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  return {
    iratingChange: {
      enabled:
        (config.iratingChange as { enabled?: boolean })?.enabled ?? true,
    },
    badge: {
      enabled: (config.badge as { enabled?: boolean })?.enabled ?? true,
      badgeFormat: ((config.badge as { badgeFormat?: string })?.badgeFormat as 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license') ?? 'license-color-rating-bw'
    },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    gap: { enabled: (config.gap as { enabled?: boolean })?.enabled ?? true },
    interval: { enabled: (config.interval as { enabled?: boolean })?.enabled ?? false },
    lastTime: {
      enabled: (config.lastTime as { enabled?: boolean; timeFormat?: string })?.enabled ?? true,
      timeFormat: ((config.lastTime as { enabled?: boolean; timeFormat?: string })?.timeFormat as 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds') ?? 'full',
    },
    fastestTime: {
      enabled: (config.fastestTime as { enabled?: boolean; timeFormat?: string })?.enabled ?? true,
      timeFormat: ((config.fastestTime as { enabled?: boolean; timeFormat?: string })?.timeFormat as 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds') ?? 'full',
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
    headerBar: {
      enabled: (config.headerBar as { enabled?: boolean })?.enabled ?? true,
      sessionName: { enabled: (config.headerBar as { sessionName?: { enabled?: boolean } })?.sessionName?.enabled ?? true },
      timeRemaining: { enabled: (config.headerBar as { timeRemaining?: { enabled?: boolean } })?.timeRemaining?.enabled ?? true },
      incidentCount: { enabled: (config.headerBar as { incidentCount?: { enabled?: boolean } })?.incidentCount?.enabled ?? true },
      brakeBias: { enabled: (config.headerBar as { brakeBias?: { enabled?: boolean } })?.brakeBias?.enabled ?? false },
      localTime: { enabled: (config.headerBar as { localTime?: { enabled?: boolean } })?.localTime?.enabled ?? false },
      trackWetness: { enabled: (config.headerBar as { trackWetness?: { enabled?: boolean } })?.trackWetness?.enabled ?? false },
      airTemperature: { enabled: (config.headerBar as { airTemperature?: { enabled?: boolean } })?.airTemperature?.enabled ?? false },
      trackTemperature: { enabled: (config.headerBar as { trackTemperature?: { enabled?: boolean } })?.trackTemperature?.enabled ?? false },
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
      airTemperature: { enabled: (config.footerBar as { airTemperature?: { enabled?: boolean } })?.airTemperature?.enabled ?? true },
      trackTemperature: { enabled: (config.footerBar as { trackTemperature?: { enabled?: boolean } })?.trackTemperature?.enabled ?? true },
      displayOrder: (config.footerBar as { displayOrder?: string[] })?.displayOrder ?? ['sessionName', 'timeRemaining', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
    },
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? false,
    position: { enabled: (config.position as { enabled?: boolean })?.enabled ?? true },
    driverName: { enabled: (config.driverName as { enabled?: boolean })?.enabled ?? true },
    pitStatus: { enabled: (config.pitStatus as { enabled?: boolean })?.enabled ?? true },
    displayOrder: mergeDisplayOrder(config.displayOrder as string[]),
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
  settings: StandingsWidgetSettings;
  handleConfigChange: (changes: Partial<StandingsWidgetSettings['config']>) => void;
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
            {setting.hasSubSetting && setting.configKey === 'lapTimeDeltas' && settings.config.lapTimeDeltas.enabled && (
              <div className="flex items-center justify-between pl-8 mt-2">
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
  settings: StandingsWidgetSettings;
  handleConfigChange: (changes: Partial<StandingsWidgetSettings['config']>) => void;
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
        const itemConfig = (settings.config[barType] as any)?.[item.id] as { enabled: boolean } | undefined;

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
                  handleConfigChange({
                    [barType]: {
                      ...settings.config[barType],
                      [item.id]: { enabled }
                    }
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

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(w => w.id === SETTING_ID) as StandingsWidgetSettings | undefined;
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

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
                  <span className="text-sm text-slate-300">Drivers to show in other classes</span>
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
                  <span className="text-sm text-slate-300">Minimum drivers in player&apos;s class</span>
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
                  <span className="text-sm text-slate-300">Top drivers to always show in player&apos;s class</span>
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

            {/* Show Only When On Track Settings */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-medium text-slate-300">Show Only When On Track</h4>
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
        );
      }}
    </BaseSettingsSection>
  );
};
