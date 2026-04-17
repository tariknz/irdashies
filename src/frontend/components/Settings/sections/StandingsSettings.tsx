import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  StandingsWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { DriverNamePreview } from '../components/DriverNamePreview';
import { DEFAULT_SESSION_BAR_DISPLAY_ORDER } from '../sessionBarConstants';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import {
  SessionBarItemsList,
  SessionBarItemConfig,
} from '../components/SessionBarItemsList';

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
  {
    id: 'driverName',
    label: 'Driver Name',
    configKey: 'driverName',
    hasSubSetting: true,
  },
  { id: 'teamName', label: 'Team Name', configKey: 'teamName' },
  {
    id: 'pitStatus',
    label: 'Pit Status',
    configKey: 'pitStatus',
    hasSubSetting: true,
  },
  {
    id: 'carManufacturer',
    label: 'Car Manufacturer',
    configKey: 'carManufacturer',
    hasSubSetting: true,
  },
  { id: 'driverTag', label: 'Driver Tag', configKey: 'driverTag' },
  { id: 'badge', label: 'Driver Badge', configKey: 'badge' },
  { id: 'iratingChange', label: 'iRating Change', configKey: 'iratingChange' },
  {
    id: 'positionChange',
    label: 'Position Change',
    configKey: 'positionChange',
  },
  { id: 'gap', label: 'Gap', configKey: 'gap', hasSubSetting: true },
  {
    id: 'interval',
    label: 'Interval',
    configKey: 'interval',
    hasSubSetting: true,
  },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
  {
    id: 'lapTimeDeltas',
    label: 'Lap Time Deltas',
    configKey: 'lapTimeDeltas',
    hasSubSetting: true,
  },
  {
    id: 'avgLapTime',
    label: 'Avg Lap Time',
    configKey: 'avgLapTime',
    hasSubSetting: true,
  },
];

const defaultConfig = getWidgetDefaultConfig('standings');

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: StandingsWidgetSettings;
  handleConfigChange: (
    changes: Partial<StandingsWidgetSettings['config']>
  ) => void;
}

const DisplaySettingsList = ({
  itemsOrder,
  onReorder,
  settings,
  handleConfigChange,
}: DisplaySettingsListProps) => {
  const items = itemsOrder
    .map((id) => {
      const setting = sortableSettings.find((s) => s.id === id);
      return setting ? { ...setting } : null;
    })
    .filter((s): s is SortableSetting => s !== null);

  return (
    <SortableList
      items={items}
      onReorder={(newItems) => onReorder(newItems.map((i) => i.id))}
      renderItem={(setting, sortableProps) => {
        const configValue = settings.config[setting.configKey];
        const isEnabled = (configValue as { enabled: boolean }).enabled;

        return (
          <DraggableSettingItem
            key={setting.id}
            label={setting.label}
            enabled={isEnabled}
            onToggle={(enabled) => {
              const cv = settings.config[setting.configKey] as {
                enabled: boolean;
                [key: string]: unknown;
              };
              handleConfigChange({
                [setting.configKey]: { ...cv, enabled },
              });
            }}
            sortableProps={sortableProps}
          >
            {setting.hasSubSetting &&
              setting.configKey === 'lapTimeDeltas' &&
              settings.config.lapTimeDeltas.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">
                    Number of Laps to Show
                  </span>
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
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'avgLapTime' &&
              settings.config.avgLapTime.enabled && (
                <>
                  <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                    <span className="text-sm text-slate-300">Rolling Laps</span>
                    <select
                      value={settings.config.avgLapTime.numLaps}
                      onChange={(e) =>
                        handleConfigChange({
                          avgLapTime: {
                            ...settings.config.avgLapTime,
                            numLaps: parseInt(e.target.value),
                          },
                        })
                      }
                      className="bg-slate-700 text-white rounded-md px-2 py-1"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                      <option value={7}>7</option>
                      <option value={8}>8</option>
                      <option value={9}>9</option>
                      <option value={10}>10</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                    <span className="text-sm text-slate-300">Time Format</span>
                    <select
                      value={settings.config.avgLapTime.timeFormat}
                      onChange={(e) =>
                        handleConfigChange({
                          avgLapTime: {
                            ...settings.config.avgLapTime,
                            timeFormat: e.target.value as
                              | 'full'
                              | 'mixed'
                              | 'minutes'
                              | 'seconds-full'
                              | 'seconds-mixed'
                              | 'seconds',
                          },
                        })
                      }
                      className="bg-slate-700 text-white rounded-md px-2 py-1"
                    >
                      <option value="full">1:42.123</option>
                      <option value="mixed">1:42.1</option>
                      <option value="minutes">1:42</option>
                      <option value="seconds-full">42.123</option>
                      <option value="seconds-mixed">42.1</option>
                      <option value="seconds">42</option>
                    </select>
                  </div>
                </>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'pitStatus' &&
              settings.config.pitStatus.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Pit Time</span>
                  <ToggleSwitch
                    enabled={settings.config.pitStatus.showPitTime ?? false}
                    onToggle={(enabled) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        showPitTime?: boolean;
                        pitLapDisplayMode?: 'lastPitLap' | 'lapsSinceLastPit';
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: { ...cv, showPitTime: enabled },
                      });
                    }}
                  />
                  <span className="textP-sm text-slate-300">
                    Pitlap display mode
                  </span>
                  <select
                    value={settings.config.pitStatus.pitLapDisplayMode}
                    onChange={(e) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        showPitTime?: boolean;
                        pitLapDisplayMode?: 'lastPitLap' | 'lapsSinceLastPit';
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          pitLapDisplayMode: e.target.value as
                            | 'lastPitLap'
                            | 'lapsSinceLastPit',
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="lastPitLap">Last pit lap</option>
                    <option value="lapsSinceLastPit">
                      Laps since last pit
                    </option>
                  </select>
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'carManufacturer' &&
              settings.config.carManufacturer.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">
                    Hide If Single Make
                  </span>
                  <ToggleSwitch
                    enabled={
                      settings.config.carManufacturer.hideIfSingleMake ?? false
                    }
                    onToggle={(enabled) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        hideIfSingleMake?: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          hideIfSingleMake: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {setting.hasSubSetting &&
              (setting.configKey === 'gap' ||
                setting.configKey === 'interval') &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Decimal Places</span>
                  <select
                    value={
                      (
                        settings.config[setting.configKey] as {
                          decimalPlaces: number;
                        }
                      ).decimalPlaces
                    }
                    onChange={(e) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        decimalPlaces: number;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          decimalPlaces: parseInt(e.target.value),
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              )}
            {setting.configKey === 'badge' &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-3 justify-end">
                    {(
                      [
                        'license-color-fullrating-combo',
                        'fullrating-color-no-license',
                        'rating-color-no-license',
                        'license-color-fullrating-bw',
                        'license-color-rating-bw',
                        'rating-only-color-rating-bw',
                        'license-color-rating-bw-no-license',
                        'license-bw-rating-bw',
                        'rating-only-bw-rating-bw',
                        'license-bw-rating-bw-no-license',
                        'rating-bw-no-license',
                        'fullrating-bw-no-license',
                      ] as const
                    ).map((format) => (
                      <BadgeFormatPreview
                        key={format}
                        format={format}
                        selected={
                          (
                            configValue as {
                              enabled: boolean;
                              badgeFormat: string;
                            }
                          ).badgeFormat === format
                        }
                        onClick={() => {
                          const cv = settings.config[setting.configKey] as {
                            enabled: boolean;
                            badgeFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [setting.configKey]: { ...cv, badgeFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {setting.configKey === 'driverName' &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-3 justify-end">
                    {(
                      [
                        'name-middlename-surname',
                        'name-m.-surname',
                        'name-surname',
                        'n.-surname',
                        'surname-n.',
                        'surname',
                      ] as const
                    ).map((format) => (
                      <DriverNamePreview
                        key={format}
                        format={format}
                        selected={
                          (
                            configValue as {
                              enabled: boolean;
                              nameFormat: string;
                            }
                          ).nameFormat === format
                        }
                        onClick={() => {
                          const cv = settings.config[setting.configKey] as {
                            enabled: boolean;
                            nameFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [setting.configKey]: { ...cv, nameFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'driverName' &&
              settings.config.driverName.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">
                    Remove Numbers From Names
                  </span>
                  <ToggleSwitch
                    enabled={settings.config.driverName.removeNumbersFromName}
                    onToggle={(enabled) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        removeNumbersFromName: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          removeNumbersFromName: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'driverName' &&
              settings.config.driverName.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Status Badges</span>
                  <ToggleSwitch
                    enabled={settings.config.driverName.showStatusBadges}
                    onToggle={(enabled) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        showStatusBadges: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          showStatusBadges: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {(setting.configKey === 'fastestTime' ||
              setting.configKey === 'lastTime') &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-300"></span>
                  <select
                    value={
                      (configValue as { enabled: boolean; timeFormat: string })
                        .timeFormat
                    }
                    onChange={(e) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        timeFormat: string;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          timeFormat: e.target.value as
                            | 'full'
                            | 'mixed'
                            | 'minutes'
                            | 'seconds-full'
                            | 'seconds-mixed'
                            | 'seconds',
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
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
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as StandingsWidgetSettings | undefined;
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as StandingsWidgetSettings['config']) ??
      defaultConfig,
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('standingsTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('standingsTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Standings"
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
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
              </TabButton>
              <TabButton
                id="options"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Options
              </TabButton>
              <TabButton
                id="header"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Header
              </TabButton>
              <TabButton
                id="footer"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Footer
              </TabButton>
              <TabButton
                id="styling"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Styling
              </TabButton>
              <TabButton
                id="visibility"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Visibility
              </TabButton>
            </div>

            <div>
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <SettingsSection title="Display Order">
                  <DisplaySettingsList
                    itemsOrder={itemsOrder}
                    onReorder={handleDisplayOrderChange}
                    settings={settings}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() => {
                      const defaultOrder = sortableSettings.map((s) => s.id);
                      setItemsOrder(defaultOrder);
                      handleConfigChange({ displayOrder: defaultOrder });
                    }}
                  />
                </SettingsSection>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Driver Standings">
                    <SettingSelectRow
                      title="Drivers to show around player"
                      value={settings.config.driverStandings.buffer.toString()}
                      options={Array.from({ length: 10 }, (_, i) => {
                        const num = i + 1;
                        return { label: num.toString(), value: num.toString() };
                      })}
                      onChange={(v) =>
                        handleConfigChange({
                          driverStandings: {
                            ...settings.config.driverStandings,
                            buffer: parseInt(v),
                          },
                        })
                      }
                    />

                    <SettingSelectRow
                      title="Drivers to show in other classes"
                      value={settings.config.driverStandings.numNonClassDrivers.toString()}
                      options={Array.from({ length: 64 }, (_, i) => {
                        return { label: i.toString(), value: i.toString() };
                      })}
                      onChange={(v) =>
                        handleConfigChange({
                          driverStandings: {
                            ...settings.config.driverStandings,
                            numNonClassDrivers: parseInt(v),
                          },
                        })
                      }
                    />

                    <SettingSelectRow
                      title="Minimum drivers in player's class"
                      value={settings.config.driverStandings.minPlayerClassDrivers.toString()}
                      options={Array.from({ length: 63 }, (_, i) => {
                        const num = i + 1;
                        return { label: num.toString(), value: num.toString() };
                      })}
                      onChange={(v) =>
                        handleConfigChange({
                          driverStandings: {
                            ...settings.config.driverStandings,
                            minPlayerClassDrivers: parseInt(v),
                          },
                        })
                      }
                    />

                    <SettingSelectRow
                      title="Top drivers to always show in player's class"
                      value={settings.config.driverStandings.numTopDrivers.toString()}
                      options={Array.from({ length: 64 }, (_, i) => {
                        return { label: i.toString(), value: i.toString() };
                      })}
                      onChange={(v) =>
                        handleConfigChange({
                          driverStandings: {
                            ...settings.config.driverStandings,
                            numTopDrivers: parseInt(v),
                          },
                        })
                      }
                    />

                    {settings.config.driverStandings.numTopDrivers > 0 && (
                      <SettingSelectRow<'none' | 'theme' | 'highlight'>
                        title="Top driver divider"
                        value={
                          settings.config.driverStandings.topDriverDivider ??
                          'highlight'
                        }
                        options={[
                          { label: 'None', value: 'none' },
                          { label: 'Theme Color', value: 'theme' },
                          { label: 'Highlight Color', value: 'highlight' },
                        ]}
                        onChange={(value) =>
                          handleConfigChange({
                            driverStandings: {
                              ...settings.config.driverStandings,
                              topDriverDivider: value,
                            },
                          })
                        }
                      />
                    )}

                    <SettingToggleRow
                      title="Use Live Position Standings"
                      description="If enabled, live telemetry will be used to compute driver
                          positions. This may be less stable but will update live and
                          not only on start/finish line."
                      enabled={settings.config.useLivePosition ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({ useLivePosition: newValue })
                      }
                    />
                  </SettingsSection>

                  <SettingsSection title="Title Bar">
                    <SettingToggleRow
                      title="Show Title Bar"
                      enabled={settings.config.titleBar.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          titleBar: {
                            ...settings.config.titleBar,
                            enabled,
                          },
                        })
                      }
                    />

                    {settings.config.titleBar.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Progress Bar"
                          enabled={settings.config.titleBar.progressBar.enabled}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              titleBar: {
                                ...settings.config.titleBar,
                                progressBar: { enabled },
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  <SettingsSection title="Background">
                    <SettingSliderRow
                      title="Background Opacity"
                      value={settings.config.background.opacity ?? 40}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ background: { opacity: v } })
                      }
                    />
                  </SettingsSection>
                </>
              )}

              {/* HEADER TAB */}
              {activeTab === 'header' && (
                <SettingsSection title="Header Bar">
                  <SettingToggleRow
                    title="Show Header Bar"
                    enabled={settings.config.headerBar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        headerBar: {
                          ...settings.config.headerBar,
                          enabled,
                        },
                      })
                    }
                  />

                  {settings.config.headerBar.enabled && (
                    <SettingsSection>
                      <SessionBarItemsList
                        items={settings.config.headerBar.displayOrder}
                        onReorder={(newOrder) => {
                          handleConfigChange({
                            headerBar: {
                              ...settings.config.headerBar,
                              displayOrder: newOrder,
                            },
                          });
                        }}
                        getItemConfig={(id) => {
                          const item =
                            settings.config.headerBar[
                              id as keyof typeof settings.config.headerBar
                            ];
                          if (
                            typeof item === 'object' &&
                            item !== null &&
                            'enabled' in item
                          ) {
                            return item as SessionBarItemConfig;
                          }
                          return undefined;
                        }}
                        updateItemConfig={(id, config) => {
                          const item =
                            settings.config.headerBar[
                              id as keyof typeof settings.config.headerBar
                            ];
                          if (
                            typeof item === 'object' &&
                            item !== null &&
                            'enabled' in item
                          ) {
                            handleConfigChange({
                              headerBar: {
                                ...settings.config.headerBar,
                                [id]: {
                                  ...(item as SessionBarItemConfig),
                                  ...config,
                                },
                              },
                            });
                          }
                        }}
                      />

                      <SettingActionButton
                        label="Reset to Default Order"
                        onClick={() => {
                          handleConfigChange({
                            headerBar: {
                              ...settings.config.headerBar,
                              displayOrder: [
                                ...DEFAULT_SESSION_BAR_DISPLAY_ORDER,
                              ],
                            },
                          });
                        }}
                      />
                    </SettingsSection>
                  )}
                </SettingsSection>
              )}

              {/* FOOTER TAB */}
              {activeTab === 'footer' && (
                <SettingsSection title="Footer Bar">
                  <SettingToggleRow
                    title="Show Footer Bar"
                    enabled={settings.config.footerBar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        footerBar: {
                          ...settings.config.footerBar,
                          enabled,
                        },
                      })
                    }
                  />

                  {settings.config.footerBar.enabled && (
                    <SettingsSection>
                      <SessionBarItemsList
                        items={settings.config.footerBar.displayOrder}
                        onReorder={(newOrder) => {
                          handleConfigChange({
                            footerBar: {
                              ...settings.config.footerBar,
                              displayOrder: newOrder,
                            },
                          });
                        }}
                        getItemConfig={(id) => {
                          const item =
                            settings.config.footerBar[
                              id as keyof typeof settings.config.footerBar
                            ];
                          if (
                            typeof item === 'object' &&
                            item !== null &&
                            'enabled' in item
                          ) {
                            return item as SessionBarItemConfig;
                          }
                          return undefined;
                        }}
                        updateItemConfig={(id, config) => {
                          const item =
                            settings.config.footerBar[
                              id as keyof typeof settings.config.footerBar
                            ];
                          if (
                            typeof item === 'object' &&
                            item !== null &&
                            'enabled' in item
                          ) {
                            handleConfigChange({
                              footerBar: {
                                ...settings.config.footerBar,
                                [id]: {
                                  ...(item as SessionBarItemConfig),
                                  ...config,
                                },
                              },
                            });
                          }
                        }}
                      />

                      <SettingActionButton
                        label="Reset to Default Order"
                        onClick={() => {
                          handleConfigChange({
                            footerBar: {
                              ...settings.config.footerBar,
                              displayOrder: [
                                ...DEFAULT_SESSION_BAR_DISPLAY_ORDER,
                              ],
                            },
                          });
                        }}
                      />
                    </SettingsSection>
                  )}
                </SettingsSection>
              )}

              {/* STYLING TAB */}
              {activeTab === 'styling' && (
                <>
                  <SettingsSection title="Class Header">
                    <SettingToggleRow
                      title="Class Name Background"
                      description="Show a colored background on the class name badge"
                      enabled={
                        settings.config.classHeaderStyle?.className
                          ?.colorBackground ?? true
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          classHeaderStyle: {
                            ...settings.config.classHeaderStyle,
                            className: { colorBackground: newValue },
                          },
                        })
                      }
                    />
                    <SettingToggleRow
                      title="Class Info Background"
                      description="Show a colored background on the SOF and driver count badges"
                      enabled={
                        settings.config.classHeaderStyle?.classInfo
                          ?.colorBackground ?? true
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          classHeaderStyle: {
                            ...settings.config.classHeaderStyle,
                            classInfo: { colorBackground: newValue },
                          },
                        })
                      }
                    />
                    <SettingToggleRow
                      title="Bottom Border"
                      description="Show a colored bottom border beneath the class header row"
                      enabled={
                        settings.config.classHeaderStyle?.classDivider
                          ?.bottomBorder ?? false
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          classHeaderStyle: {
                            ...settings.config.classHeaderStyle,
                            classDivider: { bottomBorder: newValue },
                          },
                        })
                      }
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Driver Position">
                    <SettingToggleRow
                      title="Position Background"
                      description="Highlight the player's position cell with a colored background"
                      enabled={
                        settings.config.stylingOptions?.driverPosition
                          ?.background ?? true
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          stylingOptions: {
                            ...settings.config.stylingOptions,
                            driverPosition: { background: newValue },
                          },
                        })
                      }
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Car Number">
                    <SettingToggleRow
                      title="Number Background"
                      description="Show a colored background on the car number cell"
                      enabled={
                        settings.config.stylingOptions?.driverNumber
                          ?.background ?? true
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          stylingOptions: {
                            ...settings.config.stylingOptions,
                            driverNumber: {
                              ...settings.config.stylingOptions?.driverNumber,
                              background: newValue,
                            },
                          },
                        })
                      }
                    />
                    <SettingToggleRow
                      title="Number Left Border"
                      description="Show a colored left border on the car number cell"
                      enabled={
                        settings.config.stylingOptions?.driverNumber?.border ??
                        true
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          stylingOptions: {
                            ...settings.config.stylingOptions,
                            driverNumber: {
                              ...settings.config.stylingOptions?.driverNumber,
                              border: newValue,
                            },
                          },
                        })
                      }
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Badges">
                    <SettingToggleRow
                      title="Minimal License Badge"
                      description="Use desaturated colors for the iRating/license badge"
                      enabled={settings.config.stylingOptions?.badge ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          stylingOptions: {
                            ...settings.config.stylingOptions,
                            badge: newValue,
                          },
                        })
                      }
                    />
                    <SettingToggleRow
                      title="Minimal Status Badges"
                      description="Use muted borders for PIT, OUT, DNF and other status badges"
                      enabled={
                        settings.config.stylingOptions?.statusBadges ?? false
                      }
                      onToggle={(newValue) =>
                        handleConfigChange({
                          stylingOptions: {
                            ...settings.config.stylingOptions,
                            statusBadges: newValue,
                          },
                        })
                      }
                    />
                  </SettingsSection>
                </>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingDivider />

                  <SettingToggleRow
                    title="Show only when on track"
                    description="If enabled, standings will only be shown when driving"
                    enabled={settings.config.showOnlyWhenOnTrack ?? false}
                    onToggle={(newValue) =>
                      handleConfigChange({ showOnlyWhenOnTrack: newValue })
                    }
                  />
                </SettingsSection>
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
