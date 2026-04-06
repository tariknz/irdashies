import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  RelativeWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { DEFAULT_SESSION_BAR_DISPLAY_ORDER } from '../sessionBarConstants';
import { SessionVisibility } from '../components/SessionVisibility';
import { DriverNamePreview } from '../components/DriverNamePreview';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import {
  SessionBarItemsList,
  SessionBarItemConfig,
} from '../components/SessionBarItemsList';

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
  { id: 'delta', label: 'Relative', configKey: 'delta' },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
];

const defaultConfig = getWidgetDefaultConfig('relative');

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: RelativeWidgetSettings;
  handleConfigChange: (
    changes: Partial<RelativeWidgetSettings['config']>
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
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RelativeWidgetSettings | undefined;
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as RelativeWidgetSettings['config']) ??
      defaultConfig,
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('relativeTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('relativeTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Relative"
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
                      value={settings.config.buffer.toString()}
                      options={Array.from({ length: 10 }, (_, i) => {
                        const num = i + 1;
                        return { label: num.toString(), value: num.toString() };
                      })}
                      onChange={(v) =>
                        handleConfigChange({ buffer: parseInt(v) })
                      }
                    />

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

                  <SettingsSection title="Relative Time">
                    <SettingSelectRow
                      title="Decimal places"
                      description="Number of decimal places to display"
                      value={settings.config.delta.precision.toString()}
                      options={Array.from({ length: 4 }, (_, i) => ({
                        label: i.toString(),
                        value: i.toString(),
                      }))}
                      onChange={(v) =>
                        handleConfigChange({
                          delta: {
                            ...settings.config.delta,
                            precision: parseInt(v),
                          },
                        })
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
                    description="If enabled, relatives will only be shown when driving"
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
