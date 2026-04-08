import { useState, useMemo, useCallback } from 'react';
import { StandingsWidgetSettings, SettingsTabType } from '@irdashies/types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
import { SortableList, useSortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { DriverNamePreview } from '../components/DriverNamePreview';
import {
  SESSION_BAR_ITEM_LABELS,
  DEFAULT_SESSION_BAR_DISPLAY_ORDER,
} from '../sessionBarConstants';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof StandingsWidgetSettings['config'];
  hasSubSetting?: boolean;
  canRotate?: boolean;
}

const sortableSettings: SortableSetting[] = [
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
    id: 'gap',
    label: 'Gap',
    configKey: 'gap',
    hasSubSetting: true,
    canRotate: true,
  },
  {
    id: 'interval',
    label: 'Interval',
    configKey: 'interval',
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
  {
    id: 'lapTimeDeltas',
    label: 'Lap Time Deltas',
    configKey: 'lapTimeDeltas',
    hasSubSetting: true,
    canRotate: true,
  },
];

const ROTATE_COLORS = [
  '#fbbf24', // amber-400
  '#60a5fa', // blue-400
  '#4ade80', // green-400
  '#f87171', // red-400
  '#c084fc', // purple-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#818cf8', // indigo-400
  '#fb7185', // rose-400
];

interface DisplaySettingsListProps {
  itemsOrder: string[];
  settings: StandingsWidgetSettings;
  handleConfigChange: (
    changes: Partial<StandingsWidgetSettings['config']>
  ) => void;
}

const DisplaySettingsList = ({
  itemsOrder,
  settings,
  handleConfigChange,
}: DisplaySettingsListProps) => {
  const items = useMemo(() => {
    return itemsOrder
      .map((id) => {
        const setting = sortableSettings.find((s) => s.id === id);
        return setting ? { ...setting } : null;
      })
      .filter((s): s is SortableSetting => s !== null);
  }, [itemsOrder]);

  // Calculate rotation group colors and metadata

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems: SortableSetting[]) => {
      const newOrder = newItems.map((i) => i.id);
      const cleanGroups = getCleanGroups(
        newOrder,
        settings.config.rotationGroups || []
      );
      handleConfigChange({
        displayOrder: newOrder,
        rotationGroups: cleanGroups,
      });
    },
    getItemId: (item: SortableSetting) => item.id,
  });

  // Helper to get group metadata
  const groupMetadata = useMemo(() => {
    const metadata: Record<string, { isInGroup: boolean; groupIdx: number }> =
      {};
    (settings.config.rotationGroups || []).forEach((group, idx) => {
      (group.columns || []).forEach((colId) => {
        metadata[colId] = { isInGroup: true, groupIdx: idx };
      });
    });
    return metadata;
  }, [settings.config.rotationGroups]);

  // Cleanup helper to enforce adjacency and min size of 2
  const getCleanGroups = useCallback(
    (order: string[], currentGroups: { columns: string[] }[]) => {
      const newGroups: { columns: string[] }[] = [];
      currentGroups.forEach((group) => {
        const indices = group.columns
          .map((id) => order.indexOf(id))
          .filter((idx) => idx !== -1)
          .sort((a, b) => a - b);

        if (indices.length < 2) return;

        let currentBlock: string[] = [order[indices[0]]];
        for (let i = 1; i < indices.length; i++) {
          if (indices[i] === indices[i - 1] + 1) {
            currentBlock.push(order[indices[i]]);
          } else {
            if (currentBlock.length >= 2)
              newGroups.push({ columns: currentBlock });
            currentBlock = [order[indices[i]]];
          }
        }
        if (currentBlock.length >= 2) newGroups.push({ columns: currentBlock });
      });
      return newGroups;
    },
    []
  );

  const handleGroupAction = (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = displayItems.findIndex((i) => i.id === itemId);
    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= displayItems.length) return;

    const targetId = displayItems[targetIndex].id;
    const currentGroups = settings.config.rotationGroups || [];

    // Find if either item is already in a group
    const groupOfItem = currentGroups.find((g) => g.columns.includes(itemId));
    const groupOfTarget = currentGroups.find((g) =>
      g.columns.includes(targetId)
    );

    let workingGroups = [...currentGroups];

    if (groupOfItem && groupOfTarget && groupOfItem !== groupOfTarget) {
      // Merge two existing groups that are now being bridged
      const mergedColumns = Array.from(
        new Set([...groupOfItem.columns, ...groupOfTarget.columns])
      );
      workingGroups = workingGroups.filter(
        (g) => g !== groupOfItem && g !== groupOfTarget
      );
      workingGroups.push({ columns: mergedColumns });
    } else if (groupOfItem) {
      // Item is in a group, extend it to include the target
      const updatedColumns = Array.from(
        new Set([...groupOfItem.columns, targetId])
      );
      const idx = workingGroups.indexOf(groupOfItem);
      workingGroups[idx] = { ...groupOfItem, columns: updatedColumns };
    } else if (groupOfTarget) {
      // Target is in a group, add item to it
      const updatedColumns = Array.from(
        new Set([...groupOfTarget.columns, itemId])
      );
      const idx = workingGroups.indexOf(groupOfTarget);
      workingGroups[idx] = { ...groupOfTarget, columns: updatedColumns };
    } else {
      // Neither in a group, start a new one
      workingGroups.push({ columns: [itemId, targetId] });
    }

    const finalGroups = getCleanGroups(
      displayItems.map((i) => i.id),
      workingGroups
    );
    handleConfigChange({ rotationGroups: finalGroups });
  };

  const handleUngroup = (itemId: string) => {
    const workingGroups = (settings.config.rotationGroups || []).map((g) => ({
      ...g,
      columns: g.columns.filter((id) => id !== itemId),
    }));

    const finalGroups = getCleanGroups(
      displayItems.map((i) => i.id),
      workingGroups
    );
    handleConfigChange({ rotationGroups: finalGroups });
  };

  return (
    <div className="space-y-3">
      {displayItems.map((item, index) => {
        const configValue = settings.config[item.configKey];
        const isEnabled = (configValue as { enabled: boolean }).enabled;
        const meta = groupMetadata[item.id];
        const sortableProps = getItemProps(item);

        const prevItem = index > 0 ? displayItems[index - 1] : null;
        const nextItem =
          index < displayItems.length - 1 ? displayItems[index + 1] : null;

        const canGroupUp = !!item.canRotate && !!prevItem?.canRotate;
        const canGroupDown = !!item.canRotate && !!nextItem?.canRotate;

        return (
          <DraggableSettingItem
            key={item.id}
            label={item.label}
            enabled={isEnabled}
            canRotate={item.canRotate}
            isInGroup={!!meta?.isInGroup}
            groupColor={
              meta?.isInGroup
                ? ROTATE_COLORS[meta.groupIdx % ROTATE_COLORS.length]
                : undefined
            }
            canGroupUp={canGroupUp}
            canGroupDown={canGroupDown}
            onGroupUp={() => handleGroupAction(item.id, 'up')}
            onGroupDown={() => handleGroupAction(item.id, 'down')}
            onUngroup={() => handleUngroup(item.id)}
            sortableProps={sortableProps}
            onToggle={(enabled) => {
              const cv = settings.config[item.configKey] as {
                enabled: boolean;
                [key: string]: unknown;
              };
              handleConfigChange({
                [item.configKey]: { ...cv, enabled },
              });
            }}
          >
            {item.hasSubSetting &&
              item.configKey === 'lapTimeDeltas' &&
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
            {item.hasSubSetting &&
              item.configKey === 'pitStatus' &&
              settings.config.pitStatus.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Pit Time</span>
                  <ToggleSwitch
                    enabled={settings.config.pitStatus.showPitTime ?? false}
                    onToggle={(enabled) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        showPitTime?: boolean;
                        pitLapDisplayMode?: 'lastPitLap' | 'lapsSinceLastPit';
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: { ...cv, showPitTime: enabled },
                      });
                    }}
                  />
                  <span className="text-sm text-slate-300">
                    Pitlap display mode
                  </span>
                  <select
                    value={settings.config.pitStatus.pitLapDisplayMode}
                    onChange={(e) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        showPitTime?: boolean;
                        pitLapDisplayMode?: 'lastPitLap' | 'lapsSinceLastPit';
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
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
            {item.hasSubSetting &&
              item.configKey === 'carManufacturer' &&
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
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        hideIfSingleMake?: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
                          ...cv,
                          hideIfSingleMake: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {item.hasSubSetting &&
              (item.configKey === 'gap' || item.configKey === 'interval') &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Decimal Places</span>
                  <select
                    value={
                      (
                        settings.config[item.configKey] as {
                          decimalPlaces: number;
                        }
                      ).decimalPlaces
                    }
                    onChange={(e) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        decimalPlaces: number;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
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
            {item.configKey === 'badge' &&
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
                          const cv = settings.config[item.configKey] as {
                            enabled: boolean;
                            badgeFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [item.configKey]: { ...cv, badgeFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {item.configKey === 'driverName' &&
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
                          const cv = settings.config[item.configKey] as {
                            enabled: boolean;
                            nameFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [item.configKey]: { ...cv, nameFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {item.hasSubSetting &&
              item.configKey === 'driverName' &&
              settings.config.driverName.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">
                    Remove Numbers From Names
                  </span>
                  <ToggleSwitch
                    enabled={settings.config.driverName.removeNumbersFromName}
                    onToggle={(enabled) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        removeNumbersFromName: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
                          ...cv,
                          removeNumbersFromName: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {item.hasSubSetting &&
              item.configKey === 'driverName' &&
              settings.config.driverName.enabled && (
                <div className="flex items-center justify-between pl-8 mt-2 indent-8">
                  <span className="text-sm text-slate-300">Status Badges</span>
                  <ToggleSwitch
                    enabled={settings.config.driverName.showStatusBadges}
                    onToggle={(enabled) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        showStatusBadges: boolean;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
                          ...cv,
                          showStatusBadges: enabled,
                        },
                      });
                    }}
                  />
                </div>
              )}
            {(item.configKey === 'fastestTime' ||
              item.configKey === 'lastTime') &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-300"></span>
                  <select
                    value={
                      (configValue as { enabled: boolean; timeFormat: string })
                        .timeFormat
                    }
                    onChange={(e) => {
                      const cv = settings.config[item.configKey] as {
                        enabled: boolean;
                        timeFormat: string;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [item.configKey]: {
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
      })}
    </div>
  );
};

interface BarItemsListProps {
  items: string[];
  onReorder: (newOrder: string[]) => void;
  barType: 'headerBar' | 'footerBar';
  settings: StandingsWidgetSettings;
  handleConfigChange: (
    changes: Partial<StandingsWidgetSettings['config']>
  ) => void;
}

const BarItemsList = ({
  items,
  onReorder,
  barType,
  settings,
  handleConfigChange,
}: BarItemsListProps) => {
  const wrappedItems = useMemo(() => items.map((id) => ({ id })), [items]);

  return (
    <SortableList
      items={wrappedItems}
      onReorder={(newItems) => onReorder(newItems.map((i) => i.id))}
      renderItem={(item, sortableProps) => {
        const itemConfig = (
          settings.config[
            barType
          ] as StandingsWidgetSettings['config']['headerBar']
        )?.[item.id as keyof StandingsWidgetSettings['config']['headerBar']] as
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
          <DraggableSettingItem
            key={item.id}
            label={SESSION_BAR_ITEM_LABELS[item.id]}
            enabled={itemConfig?.enabled ?? true}
            onToggle={(enabled) => {
              const currentUnit =
                itemConfig && 'unit' in itemConfig ? itemConfig.unit : 'Metric';
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
                        : item.id === 'sessionTime' || item.id === 'sessionLaps'
                          ? { ...(itemConfig as object), enabled }
                          : { enabled },
                },
              });
            }}
            sortableProps={sortableProps}
          >
            {(item.id === 'airTemperature' || item.id === 'trackTemperature') &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex items-center justify-between mt-2">
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
                <div className="flex items-center justify-end gap-2 mt-2">
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
            {item.id === 'sessionLaps' &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex items-center justify-end gap-3 mt-2">
                  <span></span>
                  <select
                    value={'mode' in itemConfig ? itemConfig.mode : 'Elapsed'}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...(itemConfig as object),
                            mode: e.target.value as 'Elapsed' | 'Remaining',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Elapsed">Elapsed</option>
                    <option value="Remaining">Remaining</option>
                  </select>
                </div>
              )}
            {item.id === 'sessionTime' &&
              itemConfig &&
              'enabled' in itemConfig &&
              itemConfig.enabled && (
                <div className="flex items-center justify-end gap-3 mt-2">
                  <span></span>
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
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
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
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="minimal">2:34</option>
                    <option value="hh:mm">00:12:34</option>
                  </select>
                  <select
                    value={
                      'labelStyle' in itemConfig
                        ? (itemConfig as { labelStyle: string }).labelStyle
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
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="none">None</option>
                    <option value="short">Short</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              )}
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const StandingsSettings = ({
  settings,
  onUpdate,
}: {
  settings: StandingsWidgetSettings;
  onUpdate: (changes: Partial<StandingsWidgetSettings>) => void;
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabType>('display');

  if (!settings?.config) return null;

  const handleConfigChange = (
    changes: Partial<StandingsWidgetSettings['config']>
  ) => {
    onUpdate({
      config: {
        ...settings.config,
        ...changes,
      },
    });
  };

  const tabs: { id: SettingsTabType; label: string }[] = [
    { id: 'display', label: 'Display' },
    { id: 'options', label: 'Options' },
    { id: 'header', label: 'Header' },
    { id: 'footer', label: 'Footer' },
    { id: 'visibility', label: 'Visibility' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-lg">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            activeTab={activeTab}
            id={tab.id}
            setActiveTab={setActiveTab}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
        {activeTab === 'options' && (
          <div className="space-y-6">
            <SettingsSection title="General">
              <SettingToggleRow
                title="Show only when on track"
                enabled={settings.config.showOnlyWhenOnTrack}
                onToggle={(enabled) =>
                  handleConfigChange({ showOnlyWhenOnTrack: enabled })
                }
              />
              <SettingToggleRow
                title="Use Live Position"
                description="Use exact track position instead of timing line crossings (more accurate during race, but may flicker at lines)"
                enabled={settings.config.useLivePosition ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({ useLivePosition: enabled })
                }
              />
            </SettingsSection>

            <SettingsSection title="Header Class Styling">
              <SettingSelectRow
                title="Header Style"
                value={
                  (settings.config.classHeaderStyle as string) || 'standard'
                }
                options={[
                  { label: 'Standard', value: 'standard' },
                  { label: 'Compact', value: 'compact' },
                  { label: 'Minimal', value: 'minimal' },
                ]}
                onChange={(value) =>
                  handleConfigChange({
                    classHeaderStyle:
                      value as StandingsWidgetSettings['config']['classHeaderStyle'],
                  })
                }
              />
            </SettingsSection>

            <SettingsSection title="Reset">
              <div className="pt-4 flex justify-center">
                <SettingActionButton
                  label="Reset Position"
                  onClick={() =>
                    onUpdate({
                      position: undefined,
                    } as Partial<StandingsWidgetSettings>)
                  }
                />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === 'display' && (
          <DisplaySettingsList
            itemsOrder={settings.config.displayOrder}
            settings={settings}
            handleConfigChange={handleConfigChange}
          />
        )}

        {activeTab === 'header' && (
          <SettingsSection title="Header Bar Items">
            <BarItemsList
              items={
                settings.config.headerBar?.displayOrder ||
                DEFAULT_SESSION_BAR_DISPLAY_ORDER
              }
              onReorder={(newOrder) =>
                handleConfigChange({
                  headerBar: {
                    ...settings.config.headerBar,
                    displayOrder: newOrder,
                  },
                })
              }
              barType="headerBar"
              settings={settings}
              handleConfigChange={handleConfigChange}
            />
          </SettingsSection>
        )}

        {activeTab === 'footer' && (
          <SettingsSection title="Footer Bar Items">
            <BarItemsList
              items={
                settings.config.footerBar?.displayOrder ||
                DEFAULT_SESSION_BAR_DISPLAY_ORDER
              }
              onReorder={(newOrder) =>
                handleConfigChange({
                  footerBar: {
                    ...settings.config.footerBar,
                    displayOrder: newOrder,
                  },
                })
              }
              barType="footerBar"
              settings={settings}
              handleConfigChange={handleConfigChange}
            />
          </SettingsSection>
        )}

        {activeTab === 'visibility' && (
          <SessionVisibility
            sessionVisibility={settings.config.sessionVisibility}
            handleConfigChange={(newConfig) =>
              handleConfigChange(
                newConfig as Partial<StandingsWidgetSettings['config']>
              )
            }
          />
        )}
      </div>
    </div>
  );
};
