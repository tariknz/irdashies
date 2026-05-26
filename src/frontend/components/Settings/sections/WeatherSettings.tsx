import { useEffect, useRef, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  WeatherWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
  type WeatherConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingActionButton } from '../components/SettingActionButton';

const SETTING_ID = 'weather';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof WeatherWidgetSettings['config'];
}

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: WeatherWidgetSettings;
  handleConfigChange: (
    changes: Partial<WeatherWidgetSettings['config']>
  ) => void;
}

const sortableSettings: SortableSetting[] = [
  { id: 'trackTemp', label: 'Track Temperature', configKey: 'trackTemp' },
  { id: 'airTemp', label: 'Air Temperature', configKey: 'airTemp' },
  { id: 'wind', label: 'Wind', configKey: 'wind' },
  { id: 'humidity', label: 'Humidity', configKey: 'humidity' },
  { id: 'precipitation', label: 'Precipitation', configKey: 'precipitation' },
  { id: 'wetness', label: 'Wetness', configKey: 'wetness' },
  { id: 'trackState', label: 'Track State', configKey: 'trackState' },
];

const defaultConfig = getWidgetDefaultConfig('weather');
const sortableSettingIds = sortableSettings.map((setting) => setting.id);

const mergeItemsOrder = (itemsOrder = defaultConfig.displayOrder) => {
  const mergedOrder = [...itemsOrder];

  sortableSettingIds.forEach((id) => {
    if (!mergedOrder.includes(id)) {
      mergedOrder.push(id);
    }
  });

  return mergedOrder;
};

const areStringArraysEqual = (first: string[] | undefined, second: string[]) =>
  Array.isArray(first) &&
  first.length === second.length &&
  first.every((value, index) => value === second[index]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeEnabledConfig = (
  value: unknown,
  fallback: { enabled: boolean }
) => ({
  enabled:
    isObjectRecord(value) && typeof value.enabled === 'boolean'
      ? value.enabled
      : fallback.enabled,
});

const isSortableSettingId = (value: unknown): value is string =>
  typeof value === 'string' && sortableSettingIds.includes(value);

const normalizeDisplayOrder = (value: unknown) => {
  if (!Array.isArray(value)) {
    return defaultConfig.displayOrder;
  }

  const displayOrder: string[] = [];

  value.forEach((id) => {
    if (isSortableSettingId(id) && !displayOrder.includes(id)) {
      displayOrder.push(id);
    }
  });

  return displayOrder.length > 0 ? displayOrder : defaultConfig.displayOrder;
};

const normalizeSessionVisibility = (
  value: unknown
): WeatherConfig['sessionVisibility'] => {
  const saved = isObjectRecord(value) ? value : {};
  const fallback = defaultConfig.sessionVisibility;

  return {
    race: typeof saved.race === 'boolean' ? saved.race : fallback.race,
    loneQualify:
      typeof saved.loneQualify === 'boolean'
        ? saved.loneQualify
        : fallback.loneQualify,
    openQualify:
      typeof saved.openQualify === 'boolean'
        ? saved.openQualify
        : fallback.openQualify,
    practice:
      typeof saved.practice === 'boolean' ? saved.practice : fallback.practice,
    offlineTesting:
      typeof saved.offlineTesting === 'boolean'
        ? saved.offlineTesting
        : fallback.offlineTesting,
  };
};

const normalizeWeatherConfig = (config: unknown): WeatherConfig => {
  const saved = isObjectRecord(config) ? config : {};
  const background = isObjectRecord(saved.background)
    ? saved.background
    : undefined;
  const val = background?.opacity;
  const opacity = Number.isFinite(val)
    ? Math.max(0, Math.min(100, Number(val)))
    : defaultConfig.background.opacity;
  const displayOrder = normalizeDisplayOrder(saved.displayOrder);

  return {
    ...defaultConfig,
    background: {
      opacity,
    },
    layout:
      saved.layout === 'vertical' || saved.layout === 'horizontal'
        ? saved.layout
        : defaultConfig.layout,
    horizontalMode:
      saved.horizontalMode === 'compact' || saved.horizontalMode === 'full'
        ? saved.horizontalMode
        : defaultConfig.horizontalMode,
    displayOrder,
    showOnlyWhenOnTrack:
      typeof saved.showOnlyWhenOnTrack === 'boolean'
        ? saved.showOnlyWhenOnTrack
        : defaultConfig.showOnlyWhenOnTrack,
    airTemp: normalizeEnabledConfig(saved.airTemp, defaultConfig.airTemp),
    trackTemp: normalizeEnabledConfig(saved.trackTemp, defaultConfig.trackTemp),
    humidity: normalizeEnabledConfig(saved.humidity, defaultConfig.humidity),
    wetness: normalizeEnabledConfig(saved.wetness, defaultConfig.wetness),
    trackState: normalizeEnabledConfig(
      saved.trackState,
      defaultConfig.trackState
    ),
    precipitation: normalizeEnabledConfig(
      saved.precipitation,
      defaultConfig.precipitation
    ),
    wind: normalizeEnabledConfig(saved.wind, defaultConfig.wind),
    units:
      saved.units === 'auto' ||
      saved.units === 'Metric' ||
      saved.units === 'Imperial'
        ? saved.units
        : defaultConfig.units,
    sessionVisibility: normalizeSessionVisibility(saved.sessionVisibility),
  };
};

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
        const isEnabled =
          (configValue as { enabled?: boolean } | undefined)?.enabled ?? true;

        return (
          <DraggableSettingItem
            key={setting.id}
            label={setting.label}
            enabled={isEnabled}
            onToggle={(enabled) => {
              const cv =
                (settings.config[setting.configKey] as
                  | { enabled?: boolean; [key: string]: unknown }
                  | undefined) ?? {};
              handleConfigChange({
                [setting.configKey]: { ...cv, enabled },
              });
            }}
            sortableProps={sortableProps}
          />
        );
      }}
    />
  );
};

export const WeatherSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const onDashboardUpdatedRef = useRef(onDashboardUpdated);
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const normalizedConfig = normalizeWeatherConfig(savedSettings?.config);
  const mergedConfig = {
    ...normalizedConfig,
    displayOrder: mergeItemsOrder(normalizedConfig.displayOrder),
  };
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: mergedConfig,
  });

  const [itemsOrder, setItemsOrder] = useState(mergedConfig.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('weatherTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('weatherTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    onDashboardUpdatedRef.current = onDashboardUpdated;
  }, [onDashboardUpdated]);

  useEffect(() => {
    if (!currentDashboard) return;

    const normalizedConfig = normalizeWeatherConfig(savedSettings?.config);
    const mergedDisplayOrder = mergeItemsOrder(normalizedConfig.displayOrder);
    const nextSettings: WeatherWidgetSettings = {
      enabled: savedSettings?.enabled ?? false,
      config: {
        ...normalizedConfig,
        displayOrder: mergedDisplayOrder,
      },
    };

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;

      setSettings(nextSettings);
      setItemsOrder(mergedDisplayOrder);
    });

    if (
      savedSettings &&
      onDashboardUpdatedRef.current &&
      !areStringArraysEqual(normalizedConfig.displayOrder, mergedDisplayOrder)
    ) {
      const updatedWidgets = currentDashboard.widgets.map((widget) =>
        widget.id === SETTING_ID
          ? {
              ...widget,
              config: {
                ...normalizedConfig,
                displayOrder: mergedDisplayOrder,
              },
            }
          : widget
      );

      onDashboardUpdatedRef.current({
        ...currentDashboard,
        widgets: updatedWidgets,
      });
    }

    return () => {
      isActive = false;
    };
  }, [currentDashboard, savedSettings]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  // Render settings using the BaseSettingsSection helper.
  // Children is provided as a function which receives `handleConfigChange`.
  return (
    <BaseSettingsSection
      title="Weather"
      description="Show weather related readings (air/track temperature, wind, wetness, track state)."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
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
                <SettingsSection title="Options">
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

                  <SettingButtonGroupRow<'vertical' | 'horizontal'>
                    title="Layout"
                    value={settings.config.layout ?? 'vertical'}
                    options={[
                      { label: 'Vertical', value: 'vertical' },
                      { label: 'Horizontal', value: 'horizontal' },
                    ]}
                    onChange={(v) => handleConfigChange({ layout: v })}
                  />

                  {settings.config.layout === 'horizontal' && (
                    <SettingButtonGroupRow<'compact' | 'full'>
                      title="Horizontal View"
                      value={settings.config.horizontalMode ?? 'compact'}
                      options={[
                        { label: 'Compact', value: 'compact' },
                        { label: 'Full', value: 'full' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({ horizontalMode: v })
                      }
                    />
                  )}

                  <SettingButtonGroupRow<'auto' | 'Metric' | 'Imperial'>
                    title="Temperature Units"
                    value={settings.config.units ?? 'auto'}
                    options={[
                      { label: 'Auto', value: 'auto' },
                      { label: '°C', value: 'Metric' },
                      { label: '°F', value: 'Imperial' },
                    ]}
                    onChange={(v) => handleConfigChange({ units: v })}
                  />
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
                    description="If enabled, weather will only be shown when driving"
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
