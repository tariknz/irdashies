import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  WeatherWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
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
  { id: 'precipitation', label: 'Precipitation', configKey: 'precipitation' },
  { id: 'wetness', label: 'Wetness', configKey: 'wetness' },
  { id: 'trackState', label: 'Track State', configKey: 'trackState' },
];

const defaultConfig = getWidgetDefaultConfig('weather');

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
          />
        );
      }}
    />
  );
};

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as WeatherWidgetSettings['config']) ??
      defaultConfig,
  });

  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('weatherTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('weatherTab', activeTab);
  }, [activeTab]);

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
