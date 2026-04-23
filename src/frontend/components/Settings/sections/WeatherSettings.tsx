import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '@irdashies/types';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';

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
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('weather');

  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Render settings using the BaseSettingsSection helper.
  // Children is provided as a function which receives `handleConfigChange`.
  return (
    <BaseSettingsSection
      title="Weather"
      description="Show weather related readings (air/track temperature, wind, wetness, track state)."
      widgetType={'weather'}
      settings={settings}
      onSettingsChange={setSettings}
    >
      {(handleConfigChange, handleVisibilityConfigChange) => {
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
                <SettingVisibilitySection
                  config={settings.visibilityConfig}
                  handleConfigChange={handleVisibilityConfigChange}
                />
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
