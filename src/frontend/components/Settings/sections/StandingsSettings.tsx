import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';

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
  { id: 'driverName', label: 'Driver Name', configKey: 'driverName', hasSubSetting: true },
  { id: 'pitStatus', label: 'Pit Status', configKey: 'pitStatus' },
  { id: 'carManufacturer', label: 'Car Manufacturer', configKey: 'carManufacturer' },
  { id: 'badge', label: 'Driver Badge', configKey: 'badge' },
  { id: 'iRating', label: 'iRating', configKey: 'iRating' },
  { id: 'iratingChange', label: 'iRating Change', configKey: 'iratingChange' },
  { id: 'delta', label: 'Delta', configKey: 'delta' },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
  { id: 'lapTimeDeltas', label: 'Lap Time Deltas', configKey: 'lapTimeDeltas', hasSubSetting: true },
];

const defaultConfig: StandingsWidgetSettings['config'] = {
  iRating: { enabled: true },
  iratingChange: { enabled: true },
  badge: { enabled: true },
  delta: { enabled: true },
  lastTime: { enabled: true },
  fastestTime: { enabled: true },
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
  lapTimeDeltas: { enabled: false, numLaps: 3 },
  position: true,
  driverName: { enabled: true, width: 250 },
  pitStatus: true,
  displayOrder: sortableSettings.map(s => s.id)
};

// Helper function to merge existing displayOrder with new default items
const mergeDisplayOrder = (existingOrder?: string[]): string[] => {
  if (!existingOrder) return defaultConfig.displayOrder;

  const allIds = sortableSettings.map(s => s.id);
  const merged = [...existingOrder];

  // Add any missing new items to the end
  allIds.forEach(id => {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  });

  return merged;
};

// Migration function to handle missing properties in the new config format
const migrateConfig = (
  savedConfig: unknown
): StandingsWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  // Handle new format with missing properties
  return {
    iRating: {
      enabled:
        (config.iRating as { enabled?: boolean })?.enabled ?? true,
    },
    iratingChange: {
      enabled:
        (config.iratingChange as { enabled?: boolean })?.enabled ?? true,
    },
    badge: { enabled: (config.badge as { enabled?: boolean })?.enabled ?? true },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    lastTime: {
      enabled: (config.lastTime as { enabled?: boolean })?.enabled ?? true,
    },
    fastestTime: {
      enabled: (config.fastestTime as { enabled?: boolean })?.enabled ?? true,
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
    position: (config.position as boolean) ?? true,
    driverName: {
      enabled: typeof config.driverName === 'boolean'
        ? config.driverName
        : (config.driverName as { enabled?: boolean })?.enabled ?? true,
      width: (config.driverName as { width?: number })?.width ?? 250,
    },
    pitStatus: (config.pitStatus as boolean) ?? true,
    displayOrder: mergeDisplayOrder(config.displayOrder as string[]),
  };
};

interface SortableItemProps {
  setting: SortableSetting;
  settings: StandingsWidgetSettings;
  handleConfigChange: (changes: Partial<StandingsWidgetSettings['config']>) => void;
}

const SortableItem = ({ setting, settings, handleConfigChange }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: setting.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const configValue = settings.config[setting.configKey];
  const isEnabled = setting.configKey === 'driverName'
    ? (configValue as { enabled: boolean; width: number }).enabled
    : setting.configKey === 'lapTimeDeltas'
      ? (configValue as { enabled: boolean }).enabled
      : typeof configValue === 'boolean'
        ? configValue
        : (configValue as { enabled: boolean }).enabled;

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
          >
            <DotsSixVerticalIcon size={16} className="text-slate-400" />
          </div>
          <span className="text-sm text-slate-300">{setting.label}</span>
        </div>
        <ToggleSwitch
          enabled={isEnabled}
          onToggle={(enabled) => {
            if (setting.configKey === 'driverName') {
              handleConfigChange({
                driverName: {
                  ...settings.config.driverName,
                  enabled
                }
              });
            } else if (setting.configKey === 'lapTimeDeltas') {
              handleConfigChange({
                lapTimeDeltas: {
                  ...settings.config.lapTimeDeltas,
                  enabled
                }
              });
            } else if (typeof settings.config[setting.configKey] === 'boolean') {
              handleConfigChange({ [setting.configKey]: enabled });
            } else {
              handleConfigChange({ [setting.configKey]: { enabled } });
            }
          }}
        />
      </div>
      {setting.hasSubSetting && setting.configKey === 'driverName' && settings.config.driverName.enabled && (
        <div className="flex items-center justify-between pl-8 mt-2">
          <span className="text-sm text-slate-300">Width</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="100"
              max="500"
              value={settings.config.driverName.width}
              onChange={(e) =>
                handleConfigChange({
                  driverName: {
                    ...settings.config.driverName,
                    width: parseInt(e.target.value),
                  },
                })
              }
              className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        const handleDragEnd = (event: DragEndEvent) => {
          const { active, over } = event;

          if (over && active.id !== over.id) {
            setItemsOrder((items) => {
              const oldIndex = items.indexOf(active.id as string);
              const newIndex = items.indexOf(over.id as string);
              const newOrder = arrayMove(items, oldIndex, newIndex);

              // Save the new order to config
              handleConfigChange({ displayOrder: newOrder });

              return newOrder;
            });
          }
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                <SortableContext items={itemsOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {itemsOrder.map((itemId) => {
                      const setting = sortableSettings.find(s => s.id === itemId);
                      if (!setting) return null;
                      return (
                        <SortableItem
                          key={setting.id}
                          setting={setting}
                          settings={settings}
                          handleConfigChange={handleConfigChange}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
          {/* Driver Standings Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Driver Standings
              </h3>
            </div>
            <div className="space-y-3 px-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Drivers to show around player
                </span>
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
                <span className="text-sm text-slate-300">
                  Drivers to show in other classes
                </span>
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
                <span className="text-sm text-slate-300">
                  Minimum drivers in player&apos;s class
                </span>
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
                <span className="text-sm text-slate-300">
                  Top drivers to always show in player&apos;s class
                </span>
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
                    className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 w-8">
                    {settings.config.background.opacity}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      }}
    </BaseSettingsSection>
  );
};
