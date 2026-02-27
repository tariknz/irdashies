import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings, SessionVisibilitySettings, SettingsTabType } from '../types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
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
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingSliderRow } from '../components/SettingSliderRow';

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
    removeNumbersFromName: false,
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
    sessionTime: { enabled: true, mode: 'Remaining' },
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
    sessionTime: { enabled: false, mode: 'Remaining' },
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
        removeNumbersFromName:
        (config.driverName as { removeNumbersFromName?: boolean })
          ?.removeNumbersFromName ?? false,
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
      badgeFormat: ((config.badge as { badgeFormat?: string })?.badgeFormat as 'license-color-fullrating-combo' | 'fullrating-color-no-license' | 'license-color-fullrating-bw' | 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' | 'fullrating-bw-no-license') ?? 'license-color-rating-bw'
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
                        'fullrating-bw-no-license'
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
                <div className="flex items-center justify-between pl-4 mt-2">
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
                  <span className="text-sm text-slate-300">Remove Numbers From Names</span>
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
          | { enabled: boolean; mode?: 'Remaining' | 'Elapsed' }
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
                <div className="flex items-center justify-between pl-4 mt-2">
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
                <div className="flex items-center justify-end gap-2 pl-4 mt-2">
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
                <div className="flex items-center justify-between pl-4 mt-2">
                  <span></span>
                  <select
                    value={
                      itemConfig && 'mode' in itemConfig
                        ? itemConfig.mode
                        : 'Remaining'
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
                            mode: e.target.value as 'Remaining' | 'Elapsed',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Remaining">Remaining</option>
                    <option value="Elapsed">Elapsed</option>
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
                id="visibility"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Visibility
              </TabButton>
            </div>

            <div className="pt-4 space-y-4">

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

                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() => {
                      handleConfigChange({
                        headerBar: {
                          ...settings.config.headerBar,
                          displayOrder: [...DEFAULT_SESSION_BAR_DISPLAY_ORDER],
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

                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() => {
                      handleConfigChange({
                        footerBar: {
                          ...settings.config.footerBar,
                          displayOrder: [...DEFAULT_SESSION_BAR_DISPLAY_ORDER],
                        },
                      });
                    }}
                  />
                </SettingsSection>
                )}
                  
              </SettingsSection>
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