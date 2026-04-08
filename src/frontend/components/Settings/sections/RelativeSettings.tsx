import { useState, useMemo, useCallback } from 'react';
import {
  RelativeWidgetSettings,
  SettingsTabType,
  RelativeBadgeFormat,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
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
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSliderRow } from '../components/SettingSliderRow';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof RelativeWidgetSettings['config'];
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
  settings: RelativeWidgetSettings;
  handleConfigChange: (
    changes: Partial<RelativeWidgetSettings['config']>
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
              item.configKey === 'pitStatus' &&
              settings.config.pitStatus.enabled && (
                <div className="flex flex-col gap-2 pl-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Pit Time</span>
                    <ToggleSwitch
                      enabled={settings.config.pitStatus.showPitTime ?? false}
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
                      value={settings.config.pitStatus.pitLapDisplayMode}
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
                      <option value="lastPitLap">Last pit lap</option>
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
                      settings.config.carManufacturer.hideIfSingleMake ?? false
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
                  <span className="text-sm text-slate-300">Decimal Places</span>
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
                          (configValue as { badgeFormat: string })
                            .badgeFormat === format
                        }
                        onClick={() => {
                          handleConfigChange({
                            badge: {
                              ...settings.config.badge,
                              badgeFormat: format as RelativeBadgeFormat,
                            },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {item.configKey === 'driverName' &&
              (configValue as { enabled: boolean }).enabled && (
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
                          (configValue as { nameFormat: string }).nameFormat ===
                          format
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
                      enabled={settings.config.driverName.removeNumbersFromName}
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
                      enabled={settings.config.driverName.showStatusBadges}
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
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between pl-3 mt-2">
                  <span className="text-sm text-slate-300">Time Format</span>
                  <select
                    value={(configValue as { timeFormat: string }).timeFormat}
                    onChange={(e) => {
                      handleConfigChange({
                        [item.configKey]: {
                          ...(configValue as object),
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
  const wrappedItems = useMemo(() => items.map((id) => ({ id })), [items]);

  return (
    <SortableList
      items={wrappedItems}
      onReorder={(newItems) => onReorder(newItems.map((i) => i.id))}
      renderItem={(item, sortableProps) => {
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

        if (!itemConfig) return null;

        return (
          <DraggableSettingItem
            key={item.id}
            label={SESSION_BAR_ITEM_LABELS[item.id]}
            enabled={itemConfig.enabled}
            onToggle={(enabled) => {
              handleConfigChange({
                [barType]: {
                  ...settings.config[barType],
                  [item.id]: { ...itemConfig, enabled },
                },
              });
            }}
            sortableProps={sortableProps}
          >
            {(item.id === 'airTemperature' || item.id === 'trackTemperature') &&
              itemConfig.enabled && (
                <div className="flex items-center justify-between mt-2 pl-3">
                  <span className="text-sm text-slate-300">Unit</span>
                  <select
                    value={(itemConfig as { unit: string }).unit}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...itemConfig,
                            unit: e.target.value as 'Metric' | 'Imperial',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                  >
                    <option value="Metric">°C</option>
                    <option value="Imperial">°F</option>
                  </select>
                </div>
              )}
            {item.id === 'sessionTime' && itemConfig.enabled && (
              <div className="flex flex-col gap-2 mt-2 pl-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Mode</span>
                  <select
                    value={(itemConfig as { mode: string }).mode}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...itemConfig,
                            mode: e.target.value as 'Remaining' | 'Elapsed',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                  >
                    <option value="Remaining">Remaining</option>
                    <option value="Elapsed">Elapsed</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Format</span>
                  <select
                    value={(itemConfig as { totalFormat: string }).totalFormat}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...itemConfig,
                            totalFormat: e.target.value as 'hh:mm' | 'minimal',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                  >
                    <option value="minimal">2:34</option>
                    <option value="hh:mm">00:12:34</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Labels</span>
                  <select
                    value={(itemConfig as { labelStyle: string }).labelStyle}
                    onChange={(e) => {
                      handleConfigChange({
                        [barType]: {
                          ...settings.config[barType],
                          [item.id]: {
                            ...itemConfig,
                            labelStyle: e.target.value as
                              | 'none'
                              | 'short'
                              | 'minimal',
                          },
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1 text-xs"
                  >
                    <option value="none">None</option>
                    <option value="short">Short</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
            )}
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const RelativeSettings = ({
  settings,
  onUpdate,
}: {
  settings: RelativeWidgetSettings;
  onUpdate: (changes: Partial<RelativeWidgetSettings>) => void;
}) => {
  const { currentDashboard } = useDashboard();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('display');

  if (!currentDashboard || !settings?.config) return null;

  const handleConfigChange = (
    changes: Partial<RelativeWidgetSettings['config']>
  ) => {
    onUpdate({
      config: {
        ...settings.config,
        ...changes,
      },
    });
  };

  const handleResetPosition = () => {
    onUpdate({ position: undefined } as Partial<RelativeWidgetSettings>);
  };

  const tabs: { id: SettingsTabType; label: string }[] = [
    { id: 'display', label: 'Display' },
    { id: 'options', label: 'Options' },
    { id: 'header', label: 'Header' },
    { id: 'footer', label: 'Footer' },
    { id: 'styling', label: 'Styling' },
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
        {activeTab === 'display' && (
          <div className="space-y-6">
            <SettingsSection title="Display Order">
              <DisplaySettingsList
                itemsOrder={settings.config.displayOrder}
                settings={settings}
                handleConfigChange={handleConfigChange}
              />
            </SettingsSection>

            <SettingDivider />

            <SettingsSection title="Reset">
              <div className="pt-2 flex justify-center">
                <SettingActionButton
                  label="Reset Position"
                  onClick={handleResetPosition}
                />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === 'options' && (
          <div className="space-y-6">
            <SettingsSection title="Behavior">
              <SettingToggleRow
                title="Show only when on track"
                enabled={settings.config.showOnlyWhenOnTrack}
                onToggle={(enabled) =>
                  handleConfigChange({ showOnlyWhenOnTrack: enabled })
                }
              />
              <SettingToggleRow
                title="Use Live Position"
                description="Use exact track position instead of timing line crossings"
                enabled={settings.config.useLivePosition ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({ useLivePosition: enabled })
                }
              />
              <SettingSliderRow
                title="Driver Range"
                description="Number of drivers to show ahead and behind (each)"
                value={settings.config.buffer ?? 3}
                min={1}
                max={20}
                step={1}
                onChange={(value: number) =>
                  handleConfigChange({ buffer: value })
                }
              />
            </SettingsSection>
          </div>
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

        {activeTab === 'styling' && (
          <div className="space-y-6">
            <SettingsSection title="Appearance">
              <SettingToggleRow
                title="Compact Mode"
                enabled={settings.config.stylingOptions?.compactMode ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      compactMode: enabled,
                    },
                  })
                }
              />
              <SettingToggleRow
                title="Minimal Badges"
                enabled={settings.config.stylingOptions?.badge ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      badge: enabled,
                    },
                  })
                }
              />
              <SettingToggleRow
                title="Minimal Status Badges"
                enabled={settings.config.stylingOptions?.statusBadges ?? false}
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      statusBadges: enabled,
                    },
                  })
                }
              />
            </SettingsSection>

            <SettingsSection title="Backgrounds & Borders">
              <SettingToggleRow
                title="Position Background"
                enabled={
                  settings.config.stylingOptions?.driverPosition?.background ??
                  true
                }
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      driverPosition: {
                        ...settings.config.stylingOptions?.driverPosition,
                        background: enabled,
                      },
                    },
                  })
                }
              />
              <SettingToggleRow
                title="Number Background"
                enabled={
                  settings.config.stylingOptions?.driverNumber?.background ??
                  true
                }
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      driverNumber: {
                        ...settings.config.stylingOptions?.driverNumber,
                        background: enabled,
                      },
                    },
                  })
                }
              />
              <SettingToggleRow
                title="Number Border"
                enabled={
                  settings.config.stylingOptions?.driverNumber?.border ?? true
                }
                onToggle={(enabled) =>
                  handleConfigChange({
                    stylingOptions: {
                      ...settings.config.stylingOptions,
                      driverNumber: {
                        ...settings.config.stylingOptions?.driverNumber,
                        border: enabled,
                      },
                    },
                  })
                }
              />
            </SettingsSection>
          </div>
        )}

        {activeTab === 'visibility' && (
          <SessionVisibility
            sessionVisibility={settings.config.sessionVisibility}
            handleConfigChange={(newConfig) =>
              handleConfigChange(
                newConfig as Partial<RelativeWidgetSettings['config']>
              )
            }
          />
        )}
      </div>
    </div>
  );
};
