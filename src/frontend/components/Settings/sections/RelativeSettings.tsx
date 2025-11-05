import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
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
  { id: 'delta', label: 'Delta', configKey: 'delta' },
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
  fastestTime: { enabled: false },
  lastTime: { enabled: false },
  compound: { enabled: false },
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

const migrateConfig = (savedConfig: unknown): RelativeWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    buffer: (config.buffer as number) ?? 3,
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? 0 },
    position: { enabled: (config.position as { enabled?: boolean })?.enabled ?? true },
    carNumber: { enabled: (config.carNumber as { enabled?: boolean })?.enabled ?? true },
    countryFlags: { enabled: (config.countryFlags as { enabled?: boolean })?.enabled ?? true },
    driverName: { enabled: (config.driverName as { enabled?: boolean })?.enabled ?? true },
    pitStatus: { enabled: (config.pitStatus as { enabled?: boolean })?.enabled ?? true },
    carManufacturer: { enabled: (config.carManufacturer as { enabled?: boolean })?.enabled ?? true },
    badge: { enabled: (config.badge as { enabled?: boolean })?.enabled ?? true },
    iratingChange: { enabled: (config.iratingChange as { enabled?: boolean })?.enabled ?? false },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    fastestTime: { enabled: (config.fastestTime as { enabled?: boolean })?.enabled ?? false },
    lastTime: { enabled: (config.lastTime as { enabled?: boolean })?.enabled ?? false },
    compound: { enabled: (config.compound as { enabled?: boolean })?.enabled ?? false },
    displayOrder: mergeDisplayOrder(config.displayOrder as string[]),
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
            handleConfigChange({
              [setting.configKey]: {
                ...(settings.config[setting.configKey] as object),
                enabled
              }
            });
          }}
        />
      </div>
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
