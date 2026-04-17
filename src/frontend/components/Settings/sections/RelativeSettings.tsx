import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  RelativeWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
  RelativeBadgeFormat,
} from '@irdashies/types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
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
import { DisplaySettingsList } from './shared/DisplaySettingsList';
import type { SharedSortableSetting } from './shared/DisplaySettingsList';

const SETTING_ID = 'relative';

const sortableSettings: SharedSortableSetting[] = [
  { id: 'position', label: 'Position', configKey: 'position', canRotate: true },
  {
    id: 'carNumber',
    label: 'Car Number',
    configKey: 'carNumber',
    canRotate: true,
  },
  {
    id: 'countryFlags',
    label: 'Country Flags',
    configKey: 'countryFlags',
    canRotate: true,
  },
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
    canRotate: true,
  },
  {
    id: 'carManufacturer',
    label: 'Car Manufacturer',
    configKey: 'carManufacturer',
    hasSubSetting: true,
    canRotate: true,
  },
  {
    id: 'driverTag',
    label: 'Driver Tag',
    configKey: 'driverTag',
    canRotate: true,
  },
  { id: 'badge', label: 'Driver Badge', configKey: 'badge', canRotate: true },
  {
    id: 'iratingChange',
    label: 'iRating Change',
    configKey: 'iratingChange',
    canRotate: true,
  },
  {
    id: 'positionChange',
    label: 'Position Change',
    configKey: 'positionChange',
    canRotate: true,
  },
  {
    id: 'delta',
    label: 'Relative',
    configKey: 'delta',
    hasSubSetting: true,
    canRotate: true,
  },
  {
    id: 'fastestTime',
    label: 'Best Time',
    configKey: 'fastestTime',
    canRotate: true,
  },
  {
    id: 'lastTime',
    label: 'Last Time',
    configKey: 'lastTime',
    canRotate: true,
  },
  {
    id: 'compound',
    label: 'Tire Compound',
    configKey: 'compound',
    canRotate: true,
  },
];

const defaultConfig = getWidgetDefaultConfig('relative');

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RelativeWidgetSettings | undefined;

  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as RelativeWidgetSettings['config']) ||
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('relativeTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('relativeTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return null;

  return (
    <BaseSettingsSection
      title="Relative"
      description="Configure the relative timing display settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="relative"
    >
      {(handleConfigChange) => {
        const onConfigChange = handleConfigChange as unknown as (
          changes: Record<string, unknown>
        ) => void;

        return (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
              {(
                [
                  'display',
                  'options',
                  'header',
                  'footer',
                  'styling',
                  'visibility',
                ] as const
              ).map((tab) => (
                <TabButton
                  key={tab}
                  id={tab}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </TabButton>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <SettingsSection title="Display Order">
                  <DisplaySettingsList
                    itemsOrder={settings.config.displayOrder}
                    sortableSettings={sortableSettings}
                    rotationGroups={settings.config.rotationGroups || []}
                    getConfigValue={(key) =>
                      settings.config[key as keyof typeof settings.config] as {
                        enabled: boolean;
                        [key: string]: unknown;
                      }
                    }
                    onConfigChange={onConfigChange}
                    renderItemChildren={(
                      item: SharedSortableSetting,
                      configValue
                    ) => (
                      <>
                        {item.hasSubSetting &&
                          item.configKey === 'pitStatus' &&
                          settings.config.pitStatus.enabled && (
                            <div className="flex flex-col gap-2 pl-3 mt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">
                                  Pit Time
                                </span>
                                <ToggleSwitch
                                  enabled={
                                    settings.config.pitStatus.showPitTime ??
                                    false
                                  }
                                  onToggle={(enabled) => {
                                    handleConfigChange({
                                      pitStatus: {
                                        ...settings.config.pitStatus,
                                        showPitTime: enabled,
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">
                                  Pitlap display mode
                                </span>
                                <select
                                  value={
                                    settings.config.pitStatus.pitLapDisplayMode
                                  }
                                  onChange={(e) => {
                                    handleConfigChange({
                                      pitStatus: {
                                        ...settings.config.pitStatus,
                                        pitLapDisplayMode: e.target.value as
                                          | 'lastPitLap'
                                          | 'lapsSinceLastPit',
                                      },
                                    });
                                  }}
                                  className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                                >
                                  <option value="lastPitLap">
                                    Last pit lap
                                  </option>
                                  <option value="lapsSinceLastPit">
                                    Laps since last pit
                                  </option>
                                </select>
                              </div>
                            </div>
                          )}
                        {item.hasSubSetting &&
                          item.configKey === 'carManufacturer' &&
                          settings.config.carManufacturer.enabled && (
                            <div className="flex items-center justify-between pl-3 mt-2">
                              <span className="text-sm text-slate-300">
                                Hide If Single Make
                              </span>
                              <ToggleSwitch
                                enabled={
                                  settings.config.carManufacturer
                                    .hideIfSingleMake ?? false
                                }
                                onToggle={(enabled) => {
                                  handleConfigChange({
                                    carManufacturer: {
                                      ...settings.config.carManufacturer,
                                      hideIfSingleMake: enabled,
                                    },
                                  });
                                }}
                              />
                            </div>
                          )}
                        {item.hasSubSetting &&
                          item.configKey === 'delta' &&
                          settings.config.delta.enabled && (
                            <div className="flex items-center justify-between pl-3 mt-2">
                              <span className="text-sm text-slate-300">
                                Decimal Places
                              </span>
                              <select
                                value={settings.config.delta.precision}
                                onChange={(e) => {
                                  handleConfigChange({
                                    delta: {
                                      ...settings.config.delta,
                                      precision: parseInt(e.target.value),
                                    },
                                  });
                                }}
                                className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                              >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                              </select>
                            </div>
                          )}
                        {item.configKey === 'badge' && configValue.enabled && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-3 justify-end">
                              {(
                                [
                                  'license-color-fullrating-combo',
                                  'fullrating-color-no-license',
                                  'license-color-fullrating-bw',
                                  'license-color-rating-bw',
                                  'license-color-rating-bw-no-license',
                                  'rating-color-no-license',
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
                                      configValue as unknown as {
                                        badgeFormat: string;
                                      }
                                    ).badgeFormat === format
                                  }
                                  onClick={() => {
                                    handleConfigChange({
                                      badge: {
                                        ...settings.config.badge,
                                        badgeFormat:
                                          format as RelativeBadgeFormat,
                                      },
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {item.configKey === 'driverName' &&
                          configValue.enabled && (
                            <div className="mt-3 flex flex-col gap-3">
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
                                        configValue as unknown as {
                                          nameFormat: string;
                                        }
                                      ).nameFormat === format
                                    }
                                    onClick={() => {
                                      handleConfigChange({
                                        driverName: {
                                          ...settings.config.driverName,
                                          nameFormat: format,
                                        },
                                      });
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center justify-between pl-3">
                                <span className="text-sm text-slate-300">
                                  Remove Numbers From Names
                                </span>
                                <ToggleSwitch
                                  enabled={
                                    settings.config.driverName
                                      .removeNumbersFromName
                                  }
                                  onToggle={(enabled) => {
                                    handleConfigChange({
                                      driverName: {
                                        ...settings.config.driverName,
                                        removeNumbersFromName: enabled,
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between pl-3">
                                <span className="text-sm text-slate-300">
                                  Status Badges
                                </span>
                                <ToggleSwitch
                                  enabled={
                                    settings.config.driverName.showStatusBadges
                                  }
                                  onToggle={(enabled) => {
                                    handleConfigChange({
                                      driverName: {
                                        ...settings.config.driverName,
                                        showStatusBadges: enabled,
                                      },
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        {(item.configKey === 'fastestTime' ||
                          item.configKey === 'lastTime') &&
                          configValue.enabled && (
                            <div className="flex items-center justify-between pl-3 mt-2">
                              <span className="text-sm text-slate-300">
                                Time Format
                              </span>
                              <select
                                value={
                                  (
                                    configValue as unknown as {
                                      timeFormat: string;
                                    }
                                  ).timeFormat
                                }
                                onChange={(e) => {
                                  onConfigChange({
                                    [item.configKey]: {
                                      ...configValue,
                                      timeFormat: e.target.value,
                                    },
                                  });
                                }}
                                className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
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
                      </>
                    )}
                  />

                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() => {
                      const defaultOrder = sortableSettings.map((s) => s.id);
                      handleConfigChange({
                        displayOrder: defaultOrder,
                        rotationGroups: [],
                      });
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
                      options={Array.from({ length: 15 }, (_, i) => ({
                        label: (i + 1).toString(),
                        value: (i + 1).toString(),
                      }))}
                      onChange={(v) =>
                        handleConfigChange({ buffer: parseInt(v) })
                      }
                    />

                    <SettingToggleRow
                      title="Use Live Position Standings"
                      description="If enabled, live telemetry will be used to compute driver positions."
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
                          titleBar: { ...settings.config.titleBar, enabled },
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
                        headerBar: { ...settings.config.headerBar, enabled },
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
                          return typeof item === 'object'
                            ? (item as SessionBarItemConfig)
                            : undefined;
                        }}
                        updateItemConfig={(id, config) => {
                          const item =
                            settings.config.headerBar[
                              id as keyof typeof settings.config.headerBar
                            ];
                          if (typeof item === 'object') {
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
                        footerBar: { ...settings.config.footerBar, enabled },
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
                          return typeof item === 'object'
                            ? (item as SessionBarItemConfig)
                            : undefined;
                        }}
                        updateItemConfig={(id, config) => {
                          const item =
                            settings.config.footerBar[
                              id as keyof typeof settings.config.footerBar
                            ];
                          if (typeof item === 'object') {
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
