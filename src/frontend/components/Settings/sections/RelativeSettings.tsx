import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard, useRelativeGapStore } from '@irdashies/context';
import { RelativeWidgetSettings } from '../types';
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
  badge: { enabled: true },
  iratingChange: { enabled: false },
  delta: { enabled: true },
  fastestTime: { enabled: false, timeFormat: 'full' },
  lastTime: { enabled: false, timeFormat: 'full' },
  compound: { enabled: false },
  brakeBias: { enabled: false },
  displayOrder: sortableSettings.map(s => s.id),
  enhancedGapCalculation: {
    enabled: true,
    interpolationMethod: 'linear',
    sampleInterval: 0.01,
    maxLapHistory: 5,
  },
  titleBar: { enabled: true, progressBar: { enabled: true } },
  showOnlyWhenOnTrack: false
};

// Helper function to merge existing displayOrder with new default items
// Inserts new items in their proper position based on sortableSettings order
const mergeDisplayOrder = (existingOrder?: string[]): string[] => {
  if (!existingOrder) return defaultConfig.displayOrder;

  const allIds = sortableSettings.map(s => s.id);
  const merged = [...existingOrder];

  // Get items that are missing from existing order
  const missingIds = allIds.filter(id => !merged.includes(id));

  // For each missing item, find where to insert it based on sortableSettings positions
  missingIds.forEach(missingId => {
    const missingIndex = allIds.indexOf(missingId);

    // Find the closest existing item that comes after this missing item in sortableSettings
    // We'll insert the missing item right before that closest item
    let insertIndex = merged.length; // Default to end

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
    brakeBias: { enabled: (config.brakeBias as { enabled?: boolean })?.enabled ?? false },
    badge: { enabled: (config.badge as { enabled?: boolean })?.enabled ?? true },
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
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? false
  };
};

interface SortableItemProps {
  setting: SortableSetting;
  settings: RelativeWidgetSettings;
  handleConfigChange: (changes: Partial<RelativeWidgetSettings['config']>) => void;
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
  const isEnabled = (configValue as { enabled: boolean }).enabled;

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
            const configValue = settings.config[setting.configKey] as { enabled: boolean; [key: string]: unknown };
            handleConfigChange({
              [setting.configKey]: {
                ...configValue,
                enabled
              }
            });
          }}
        />
      </div>
      {(setting.configKey === 'fastestTime' || setting.configKey === 'lastTime') && (configValue as { enabled: boolean }).enabled && (
        <div className="flex items-center justify-between pl-8 mt-2">
          <span className="text-sm text-slate-300"></span>
          <select
            value={(configValue as { enabled: boolean; timeFormat: string }).timeFormat}
            onChange={(e) => {
              const configValue = settings.config[setting.configKey] as { enabled: boolean; timeFormat: string; [key: string]: unknown };
              handleConfigChange({
                [setting.configKey]: {
                  ...configValue,
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync settings with RelativeGapStore only on mount
  const updateStoreConfig = useRelativeGapStore((state) => state.updateConfig);

  useEffect(() => {
    // Only update on mount with the initial saved settings
    const config = settings.config.enhancedGapCalculation;
    updateStoreConfig({
      enabled: config.enabled,
      interpolationMethod: config.interpolationMethod,
      sampleInterval: config.sampleInterval,
      maxLapHistory: config.maxLapHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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
            {/* Session Bar Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Session Bar
                </h3>
              </div>
              <div className="space-y-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-300">Brake Bias</span>
                    <p className="text-xs text-slate-400">
                      Show brake bias in header (or brake valve for Clio)
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.brakeBias.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({ brakeBias: { enabled } })
                    }
                  />
                </div>
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

            {/* Enhanced Gap Calculation Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Enhanced Gap Calculation
                </h3>
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
                    <p className="text-xs text-slate-400">
                      Uses lap data interpolation for accuracy
                    </p>
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
                      // Update store immediately
                      updateStoreConfig(newConfig);
                    }}
                  />
                </div>

                {settings.config.enhancedGapCalculation.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">Interpolation Method</span>
                        <p className="text-xs text-slate-400">
                          Linear is more stable, cubic is smoother
                        </p>
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
                          // Update store immediately
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
                        <p className="text-xs text-slate-400">
                          Number of recent laps to keep for each car
                        </p>
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
                          // Update store immediately
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
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
