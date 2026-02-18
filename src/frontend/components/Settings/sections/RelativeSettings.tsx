import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings, SessionVisibilitySettings } from '../types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useSortableList } from '../../SortableList';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import {
  VALID_SESSION_BAR_ITEM_KEYS,
  SESSION_BAR_ITEM_LABELS,
  DEFAULT_SESSION_BAR_DISPLAY_ORDER,
} from '../sessionBarConstants';
import { mergeDisplayOrder } from '../../../utils/displayOrder';
import { SessionVisibility } from '../components/SessionVisibility';
import { DriverNamePreview } from '../components/DriverNamePreview';

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
  driverName: {
    enabled: true,
    showStatusBadges: true,
    nameFormat: 'name-surname',
  },
  teamName: { enabled: false },
  pitStatus: {
    enabled: true,
    showPitTime: false,
    pitLapDisplayMode: 'lapsSinceLastPit',
  },
  carManufacturer: { enabled: true, hideIfSingleMake: false },
  badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
  iratingChange: { enabled: false },
  delta: { enabled: true, precision: 2 },
  fastestTime: { enabled: false, timeFormat: 'full' },
  lastTime: { enabled: false, timeFormat: 'full' },
  compound: { enabled: false },
  displayOrder: sortableSettings.map((s) => s.id),
  titleBar: { enabled: true, progressBar: { enabled: true } },
  headerBar: {
    enabled: true,
    sessionName: { enabled: true },
    sessionTime: {
      enabled: true,
      mode: 'Remaining',
      totalFormat: 'minimal',
      labelStyle: 'minimal',
    },
    sessionLaps: { enabled: true },
    incidentCount: { enabled: true },
    brakeBias: { enabled: true },
    localTime: { enabled: false },
    sessionClockTime: { enabled: false },
    trackWetness: { enabled: false },
    precipitation: { enabled: false },
    airTemperature: { enabled: false, unit: 'Metric' },
    trackTemperature: { enabled: false, unit: 'Metric' },
    wind: { enabled: false, speedPosition: 'right' },
    displayOrder: DEFAULT_SESSION_BAR_DISPLAY_ORDER,
  },
  footerBar: {
    enabled: true,
    sessionName: { enabled: false },
    sessionTime: {
      enabled: false,
      mode: 'Remaining',
      totalFormat: 'minimal',
      labelStyle: 'minimal',
    },
    sessionLaps: { enabled: false },
    incidentCount: { enabled: false },
    brakeBias: { enabled: false },
    localTime: { enabled: true },
    sessionClockTime: { enabled: false },
    trackWetness: { enabled: true },
    precipitation: { enabled: false },
    airTemperature: { enabled: true, unit: 'Metric' },
    trackTemperature: { enabled: true, unit: 'Metric' },
    wind: { enabled: false, speedPosition: 'right' },
    displayOrder: DEFAULT_SESSION_BAR_DISPLAY_ORDER,
  },
  showOnlyWhenOnTrack: false,
  useLivePosition: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (
  savedConfig: unknown
): RelativeWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    buffer: (config.buffer as number) ?? 3,
    background: {
      opacity: (config.background as { opacity?: number })?.opacity ?? 0,
    },
    position: {
      enabled: (config.position as { enabled?: boolean })?.enabled ?? true,
    },
    carNumber: {
      enabled: (config.carNumber as { enabled?: boolean })?.enabled ?? true,
    },
    countryFlags: {
      enabled: (config.countryFlags as { enabled?: boolean })?.enabled ?? true,
    },
    driverName: {
      enabled: (config.driverName as { enabled?: boolean })?.enabled ?? true,
      showStatusBadges:
        (config.driverName as { showStatusBadges?: boolean })
          ?.showStatusBadges ?? true,
      nameFormat:
        (
          config.driverName as {
            nameFormat?:
              | 'name-middlename-surname'
              | 'name-m.-surname'
              | 'name-surname'
              | 'n.-surname'
              | 'surname-n.'
              | 'surname';
          }
        )?.nameFormat ?? 'name-middlename-surname',
    },
    teamName: {
      enabled: (config.teamName as { enabled?: boolean })?.enabled ?? false,
    },
    pitStatus: {
      enabled: (config.pitStatus as { enabled?: boolean })?.enabled ?? true,
      showPitTime:
        (config.pitStatus as { showPitTime?: boolean })?.showPitTime ?? false,
      pitLapDisplayMode:
        (
          config.pitStatus as {
            pitLapDisplayMode?: 'lastPitLap' | 'lapsSinceLastPit';
          }
        )?.pitLapDisplayMode ?? 'lapsSinceLastPit',
    },
    carManufacturer: {
      enabled:
        (config.carManufacturer as { enabled?: boolean })?.enabled ?? true,
      hideIfSingleMake:
        (config.carManufacturer as { hideIfSingleMake?: boolean })
          ?.hideIfSingleMake ?? false,
    },
    badge: {
      enabled: (config.badge as { enabled?: boolean })?.enabled ?? true,
      badgeFormat:
        ((config.badge as { badgeFormat?: string })?.badgeFormat as
          | 'license-color-fullrating-combo'
          | 'fullrating-color-no-license'
          | 'license-color-fullrating-bw'
          | 'license-color-rating-bw'
          | 'license-color-rating-bw-no-license'
          | 'rating-color-no-license'
          | 'license-bw-rating-bw'
          | 'rating-only-bw-rating-bw'
          | 'license-bw-rating-bw-no-license'
          | 'rating-bw-no-license'
          | 'fullrating-bw-no-license') ?? 'license-color-rating-bw',
    },
    iratingChange: {
      enabled:
        (config.iratingChange as { enabled?: boolean })?.enabled ?? false,
    },
    delta: {
      enabled: (config.delta as { enabled?: boolean })?.enabled ?? true,
      precision: (config.delta as { precision?: number })?.precision ?? 2,
    },
    fastestTime: {
      enabled:
        (config.fastestTime as { enabled?: boolean; timeFormat?: string })
          ?.enabled ?? false,
      timeFormat:
        ((config.fastestTime as { enabled?: boolean; timeFormat?: string })
          ?.timeFormat as
          | 'full'
          | 'mixed'
          | 'minutes'
          | 'seconds-full'
          | 'seconds-mixed'
          | 'seconds') ?? 'full',
    },
    lastTime: {
      enabled:
        (config.lastTime as { enabled?: boolean; timeFormat?: string })
          ?.enabled ?? false,
      timeFormat:
        ((config.lastTime as { enabled?: boolean; timeFormat?: string })
          ?.timeFormat as
          | 'full'
          | 'mixed'
          | 'minutes'
          | 'seconds-full'
          | 'seconds-mixed'
          | 'seconds') ?? 'full',
    },
    compound: {
      enabled: (config.compound as { enabled?: boolean })?.enabled ?? false,
    },
    displayOrder: mergeDisplayOrder(
      sortableSettings.map((s) => s.id),
      config.displayOrder as string[]
    ),
    titleBar: {
      enabled: (config.titleBar as { enabled?: boolean })?.enabled ?? true,
      progressBar: {
        enabled:
          (config.titleBar as { progressBar?: { enabled?: boolean } })
            ?.progressBar?.enabled ?? true,
      },
    },
    headerBar: {
      enabled: (config.headerBar as { enabled?: boolean })?.enabled ?? true,
      sessionName: {
        enabled:
          (config.headerBar as { sessionName?: { enabled?: boolean } })
            ?.sessionName?.enabled ?? true,
      },
      sessionTime: {
        enabled:
          (config.headerBar as { sessionTime?: { enabled?: boolean } })
            ?.sessionTime?.enabled ?? true,
        mode:
          ((config.headerBar as { sessionTime?: { mode?: string } })
            ?.sessionTime?.mode as 'Remaining' | 'Elapsed') ?? 'Remaining',
        totalFormat:
          ((config.headerBar as { sessionTime?: { totalFormat?: string } })
            ?.sessionTime?.totalFormat as 'hh:mm' | 'minimal') ?? 'minimal',
        labelStyle:
          ((config.headerBar as { sessionTime?: { labelStyle?: string } })
            ?.sessionTime?.labelStyle as 'none' | 'short' | 'minimal') ??
          'minimal',
      },
      sessionLaps: {
        enabled:
          (config.headerBar as { sessionLaps?: { enabled?: boolean } })
            ?.sessionLaps?.enabled ?? true,
      },
      incidentCount: {
        enabled:
          (config.headerBar as { incidentCount?: { enabled?: boolean } })
            ?.incidentCount?.enabled ?? true,
      },
      brakeBias: {
        enabled:
          (config.headerBar as { brakeBias?: { enabled?: boolean } })?.brakeBias
            ?.enabled ?? false,
      },
      localTime: {
        enabled:
          (config.headerBar as { localTime?: { enabled?: boolean } })?.localTime
            ?.enabled ?? false,
      },
      sessionClockTime: {
        enabled:
          (config.headerBar as { sessionClockTime?: { enabled?: boolean } })
            ?.sessionClockTime?.enabled ?? false,
      },
      trackWetness: {
        enabled:
          (config.headerBar as { trackWetness?: { enabled?: boolean } })
            ?.trackWetness?.enabled ?? false,
      },
      precipitation: {
        enabled:
          (config.headerBar as { precipitation?: { enabled?: boolean } })
            ?.precipitation?.enabled ?? false,
      },
      airTemperature: {
        enabled:
          (
            config.headerBar as {
              airTemperature?: { enabled?: boolean; unit?: string };
            }
          )?.airTemperature?.enabled ?? false,
        unit:
          ((config.headerBar as { airTemperature?: { unit?: string } })
            ?.airTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric',
      },
      trackTemperature: {
        enabled:
          (
            config.headerBar as {
              trackTemperature?: { enabled?: boolean; unit?: string };
            }
          )?.trackTemperature?.enabled ?? false,
        unit:
          ((config.headerBar as { trackTemperature?: { unit?: string } })
            ?.trackTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric',
      },
      wind: {
        enabled:
          (config.headerBar as { wind?: { enabled?: boolean } })?.wind
            ?.enabled ?? false,
        speedPosition:
          ((config.headerBar as { wind?: { speedPosition?: string } })?.wind
            ?.speedPosition as 'left' | 'right') ?? 'right',
      },
      displayOrder: mergeDisplayOrder(
        [...VALID_SESSION_BAR_ITEM_KEYS],
        (config.headerBar as { displayOrder?: string[] })?.displayOrder
      ),
    },
    footerBar: {
      enabled: (config.footerBar as { enabled?: boolean })?.enabled ?? true,
      sessionName: {
        enabled:
          (config.footerBar as { sessionName?: { enabled?: boolean } })
            ?.sessionName?.enabled ?? false,
      },
      sessionTime: {
        enabled:
          (config.footerBar as { sessionTime?: { enabled?: boolean } })
            ?.sessionTime?.enabled ?? false,
        mode:
          ((config.footerBar as { sessionTime?: { mode?: string } })
            ?.sessionTime?.mode as 'Remaining' | 'Elapsed') ?? 'Remaining',
        totalFormat:
          ((config.footerBar as { sessionTime?: { totalFormat?: string } })
            ?.sessionTime?.totalFormat as 'hh:mm' | 'minimal') ?? 'minimal',
        labelStyle:
          ((config.footerBar as { sessionTime?: { labelStyle?: string } })
            ?.sessionTime?.labelStyle as 'none' | 'short' | 'minimal') ??
          'minimal',
      },
      sessionLaps: {
        enabled:
          (config.footerBar as { sessionLaps?: { enabled?: boolean } })
            ?.sessionLaps?.enabled ?? true,
      },
      incidentCount: {
        enabled:
          (config.footerBar as { incidentCount?: { enabled?: boolean } })
            ?.incidentCount?.enabled ?? false,
      },
      brakeBias: {
        enabled:
          (config.footerBar as { brakeBias?: { enabled?: boolean } })?.brakeBias
            ?.enabled ?? false,
      },
      localTime: {
        enabled:
          (config.footerBar as { localTime?: { enabled?: boolean } })?.localTime
            ?.enabled ?? true,
      },
      sessionClockTime: {
        enabled:
          (config.footerBar as { sessionClockTime?: { enabled?: boolean } })
            ?.sessionClockTime?.enabled ?? false,
      },
      trackWetness: {
        enabled:
          (config.footerBar as { trackWetness?: { enabled?: boolean } })
            ?.trackWetness?.enabled ?? true,
      },
      precipitation: {
        enabled:
          (config.footerBar as { precipitation?: { enabled?: boolean } })
            ?.precipitation?.enabled ?? false,
      },
      airTemperature: {
        enabled:
          (
            config.footerBar as {
              airTemperature?: { enabled?: boolean; unit?: string };
            }
          )?.airTemperature?.enabled ?? true,
        unit:
          ((config.footerBar as { airTemperature?: { unit?: string } })
            ?.airTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric',
      },
      trackTemperature: {
        enabled:
          (
            config.footerBar as {
              trackTemperature?: { enabled?: boolean; unit?: string };
            }
          )?.trackTemperature?.enabled ?? true,
        unit:
          ((config.footerBar as { trackTemperature?: { unit?: string } })
            ?.trackTemperature?.unit as 'Metric' | 'Imperial') ?? 'Metric',
      },
      wind: {
        enabled:
          (config.footerBar as { wind?: { enabled?: boolean } })?.wind
            ?.enabled ?? false,
        speedPosition:
          ((config.footerBar as { wind?: { speedPosition?: string } })?.wind
            ?.speedPosition as 'left' | 'right') ?? 'right',
      },
      displayOrder: mergeDisplayOrder(
        [...VALID_SESSION_BAR_ITEM_KEYS],
        (config.footerBar as { displayOrder?: string[] })?.displayOrder
      ),
    },
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? false,
    useLivePosition: (config.useLivePosition as boolean) ?? false,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

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
                  const cv = settings.config[setting.configKey] as {
                    enabled: boolean;
                    [key: string]: unknown;
                  };
                  handleConfigChange({
                    [setting.configKey]: { ...cv, enabled },
                  });
                }}
              />
            </div>
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
                <div className="flex items-center justify-between pl-8 mt-2">
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
                <div className="flex items-center justify-between pl-8 mt-2">
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
                <div className="flex items-center justify-between pl-8 mt-2">
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
                <div className="flex items-center justify-between pl-8 mt-2">
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
  handleConfigChange: (
    changes: Partial<RelativeWidgetSettings['config']>
  ) => void;
}

const BarItemsList = ({
  items,
  onReorder,
  barType,
  settings,
  handleConfigChange,
}: BarItemsListProps) => {
  const wrappedItems = items.map((id) => ({ id }));

  const { getItemProps, displayItems } = useSortableList({
    items: wrappedItems,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-3 pl-4">
      {displayItems.map((item) => {
        const { dragHandleProps, itemProps } = getItemProps(item);
        const itemConfig = (
          settings.config[
            barType
          ] as RelativeWidgetSettings['config']['headerBar']
        )?.[item.id as keyof RelativeWidgetSettings['config']['headerBar']] as
          | { enabled: boolean; unit?: 'Metric' | 'Imperial' }
          | {
              enabled: boolean;
              mode?: 'Remaining' | 'Elapsed';
              totalFormat?: 'hh:mm' | 'minimal';
              labelStyle?: 'none' | 'short' | 'minimal';
            }
          | undefined;

        // Safety check: skip rendering if itemConfig is undefined
        if (!itemConfig) {
          return null;
        }

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
                <span className="text-sm text-slate-300">
                  {SESSION_BAR_ITEM_LABELS[item.id]}
                </span>
              </div>
              <ToggleSwitch
                enabled={itemConfig?.enabled ?? true}
                onToggle={(enabled) => {
                  const currentUnit =
                    itemConfig && 'unit' in itemConfig
                      ? itemConfig.unit
                      : 'Metric';
                  const currentSpeedPosition =
                    (itemConfig as { speedPosition?: 'left' | 'right' })
                      ?.speedPosition ?? 'right';
                  handleConfigChange({
                    [barType]: {
                      ...settings.config[barType],
                      [item.id]:
                        item.id === 'airTemperature' ||
                        item.id === 'trackTemperature'
                          ? { enabled, unit: currentUnit }
                          : item.id === 'wind'
                            ? {
                                enabled,
                                speedPosition: currentSpeedPosition,
                              }
                            : item.id === 'sessionTime'
                              ? { ...(itemConfig as object), enabled }
                              : { enabled },
                    },
                  });
                }}
              />
            </div>
            {(item.id === 'airTemperature' || item.id === 'trackTemperature') &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2">
                  <span></span>
                  <select
                    value={
                      itemConfig && 'unit' in itemConfig
                        ? itemConfig.unit
                        : 'Metric'
                    }
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            enabled:
                              itemConfig && 'enabled' in itemConfig
                                ? itemConfig.enabled
                                : true,
                            unit: e.target.value as 'Metric' | 'Imperial',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Metric">°C</option>
                    <option value="Imperial">°F</option>
                  </select>
                </div>
              )}
            {item.id === 'wind' &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex items-center justify-end gap-2 pl-8 mt-2">
                  {(['left', 'right'] as const).map((pos) => {
                    const currentPos =
                      (itemConfig as { speedPosition?: 'left' | 'right' })
                        .speedPosition ?? 'right';
                    const arrow = (
                      <svg
                        viewBox="50 80 650 720"
                        className="w-3 h-3.5 fill-current shrink-0"
                        style={{ rotate: '-14deg' }}
                      >
                        <path
                          fillRule="nonzero"
                          d="m373.75 91.496c-0.95-1.132-74.87 153.23-164.19 343.02-160.8 341.68-162.27 345.16-156.49 350.27 3.203 2.83 6.954 4.79 8.319 4.34 1.365-0.46 71.171-73.88 155.14-163.1 83.97-89.22 153.66-162.83 154.87-163.56 1.2-0.72 71.42 72.34 156.04 162.29s155.21 163.82 156.95 164.19 5.57-1.19 8.5-3.44c5.04-3.86-3.75-23.46-156.04-348-88.77-189.18-162.15-344.88-163.1-346.01z"
                        />
                      </svg>
                    );
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            [barType]: {
                              ...settings.config[barType],
                              wind: {
                                enabled: itemConfig.enabled,
                                speedPosition: pos,
                              },
                            },
                          })
                        }
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-white ${currentPos === pos ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                      >
                        {pos === 'left' ? (
                          <>
                            <span>7</span>
                            {arrow}
                          </>
                        ) : (
                          <>
                            {arrow}
                            <span>7</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            {item.id === 'sessionTime' &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex gap-2 pl-8 mt-2">
                  <select
                    value={'mode' in itemConfig ? itemConfig.mode : 'Remaining'}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...(itemConfig as object),
                            mode: e.target.value as 'Remaining' | 'Elapsed',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 flex-1"
                  >
                    <option value="Remaining">Remaining</option>
                    <option value="Elapsed">Elapsed</option>
                  </select>
                  <select
                    value={
                      'totalFormat' in itemConfig
                        ? itemConfig.totalFormat
                        : 'minimal'
                    }
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...(itemConfig as object),
                            totalFormat: e.target.value as 'hh:mm' | 'minimal',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 flex-1"
                  >
                    <option value="minimal">2:34</option>
                    <option value="hh:mm">00:12:34</option>
                  </select>
                  <select
                    value={
                      'labelStyle' in itemConfig
                        ? itemConfig.labelStyle
                        : 'minimal'
                    }
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...(itemConfig as object),
                            labelStyle: e.target.value as
                              | 'none'
                              | 'short'
                              | 'minimal',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 flex-1"
                  >
                    <option value="minimal">Minimal Labels</option>
                    <option value="short">Short Labels</option>
                    <option value="none">Hide Labels</option>
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
          <div className="space-y-8">
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
              <div className="pl-4">
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
                <h3 className="text-lg font-medium text-slate-200">
                  Driver Standings
                </h3>
              </div>
              <div className="space-y-3 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Drivers to show around player
                  </span>
                  <select
                    value={settings.config.buffer}
                    onChange={(e) =>
                      handleConfigChange({ buffer: parseInt(e.target.value) })
                    }
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
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
                <h3 className="text-lg font-medium text-slate-200">
                  Title Bar
                </h3>
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
                          enabled,
                        },
                      })
                    }
                  />
                </div>
                {settings.config.titleBar.enabled && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-300">
                      Show Progress Bar
                    </span>
                    <ToggleSwitch
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
                  </div>
                )}
              </div>
            </div>

            {/* Header Bar Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Header Bar
                </h3>
                <button
                  onClick={() => {
                    handleConfigChange({
                      headerBar: {
                        ...settings.config.headerBar,
                        displayOrder: [...DEFAULT_SESSION_BAR_DISPLAY_ORDER],
                      },
                    });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="space-y-3 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Show Header Bar
                  </span>
                  <ToggleSwitch
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
                </div>
                {settings.config.headerBar.enabled && (
                  <BarItemsList
                    items={settings.config.headerBar.displayOrder}
                    onReorder={(newOrder) => {
                      handleConfigChange({
                        headerBar: {
                          ...settings.config.headerBar,
                          displayOrder: newOrder,
                        },
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
                <h3 className="text-lg font-medium text-slate-200">
                  Footer Bar
                </h3>
                <button
                  onClick={() => {
                    handleConfigChange({
                      footerBar: {
                        ...settings.config.footerBar,
                        displayOrder: [...DEFAULT_SESSION_BAR_DISPLAY_ORDER],
                      },
                    });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="space-y-3 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Show Footer Bar
                  </span>
                  <ToggleSwitch
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
                </div>
                {settings.config.footerBar.enabled && (
                  <BarItemsList
                    items={settings.config.footerBar.displayOrder}
                    onReorder={(newOrder) => {
                      handleConfigChange({
                        footerBar: {
                          ...settings.config.footerBar,
                          displayOrder: newOrder,
                        },
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
                <h3 className="text-lg font-medium text-slate-200">
                  Background
                </h3>
              </div>
              <div className="space-y-3 pl-4">
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
                      className="h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 w-8">
                      {settings.config.background.opacity}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Relative Precision Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Relative Time
                </h3>
              </div>
              <div className="space-y-3 pl-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-300">
                      Decimal places
                    </span>
                    <p className="text-xs text-slate-400">
                      Number of decimal places to display
                    </p>
                  </div>
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
                    className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                  >
                    {[0, 1, 2, 3].map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Show Only When On Track Settings */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-medium text-slate-300">
                  Show Only When On Track
                </h4>
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

            {/* Use Live Position Standings */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-md font-medium text-slate-300">
                  Use Live Position Standings
                </h4>
                <p className="text-sm text-slate-400">
                  If enabled, live telemetry will be used to compute driver
                  positions. This may be less stable but will update live and
                  not only on start/finish line.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.config.useLivePosition ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({ useLivePosition: enabled })
                }
              />
            </div>

            {/* Session Visibility Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Session Visibility
                </h3>
              </div>
              <div className="space-y-3 pl-4">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
              </div>
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
