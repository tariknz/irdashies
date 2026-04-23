import { useState } from 'react';
import { SortableList } from '../../SortableList';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { InputWidgetSettings } from '@irdashies/types';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof InputWidgetSettings['config'];
}

const sortableSettings: SortableSetting[] = [
  { id: 'trace', label: 'Trace', configKey: 'trace' },
  { id: 'bar', label: 'Bar', configKey: 'bar' },
  { id: 'gear', label: 'Gear', configKey: 'gear' },
  { id: 'abs', label: 'ABS', configKey: 'abs' },
  { id: 'steer', label: 'Steer', configKey: 'steer' },
];

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: InputWidgetSettings;
  handleConfigChange: (changes: Partial<InputWidgetSettings['config']>) => void;
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

export const InputSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('input');

  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  return (
    <BaseSettingsSection
      title="Input Traces"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      widgetType={'input'}
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
                <>
                  <SettingsSection title="Options">
                    <SettingToggleRow
                      title="Use Raw Inputs"
                      description="Disables iRacing's automated input processing, showing direct pedal telemetry without assists like auto-clutch or anti-stall."
                      enabled={settings.config.useRawValues}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          useRawValues: enabled,
                        })
                      }
                    />
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

                  {/* Trace Settings */}
                  <SettingsSection title="Trace">
                    <SettingToggleRow
                      title="Enable Trace Display"
                      enabled={settings.config.trace.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          trace: { ...settings.config.trace, enabled },
                        })
                      }
                    />

                    {settings.config.trace.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Trace"
                          enabled={settings.config.trace.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Trace"
                          enabled={settings.config.trace.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Trace"
                          enabled={settings.config.trace.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS"
                          enabled={settings.config.trace.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                includeAbs: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Steering Trace"
                          enabled={settings.config.trace.includeSteer ?? true}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                includeSteer: enabled,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Stroke Width"
                          value={settings.config.trace.strokeWidth ?? 3}
                          units="px"
                          min={0}
                          max={10}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                strokeWidth: v,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Max Samples"
                          value={settings.config.trace.maxSamples ?? 40}
                          units=" samples"
                          min={40}
                          max={1000}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...settings.config.trace,
                                maxSamples: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Bar Settings */}
                  <SettingsSection title="Bar">
                    <SettingToggleRow
                      title="Enable Bar Display"
                      enabled={settings.config.bar.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          bar: { ...settings.config.bar, enabled },
                        })
                      }
                    />

                    {settings.config.bar.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Bar"
                          enabled={settings.config.bar.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...settings.config.bar,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Bar"
                          enabled={settings.config.bar.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...settings.config.bar,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Bar"
                          enabled={settings.config.bar.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...settings.config.bar,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS Indicator"
                          enabled={settings.config.bar.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...settings.config.bar,
                                includeAbs: enabled,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* ABS Settings */}
                  <SettingsSection title="ABS Indicator">
                    <SettingToggleRow
                      title="Enable ABS Indicator"
                      enabled={settings.config.abs?.enabled ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          abs: { ...settings.config.abs, enabled: newValue },
                        })
                      }
                    />
                  </SettingsSection>

                  {/* Steer Settings */}
                  <SettingsSection title="Steer">
                    <SettingToggleRow
                      title="Enable Steer Display"
                      enabled={settings.config.steer.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          steer: {
                            ...settings.config.steer,
                            enabled: newValue,
                          },
                        })
                      }
                    />

                    {settings.config.steer.enabled && (
                      <SettingsSection>
                        <SettingSelectRow<
                          'default' | 'formula' | 'lmp' | 'nascar' | 'ushape'
                        >
                          title="Wheel Style"
                          value={
                            settings.config.steer.config.style ?? 'default'
                          }
                          options={[
                            { label: 'Default', value: 'default' },
                            { label: 'Formula', value: 'formula' },
                            { label: 'LMP', value: 'lmp' },
                            { label: 'NASCAR', value: 'nascar' },
                            { label: 'U-Shape', value: 'ushape' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              steer: {
                                ...settings.config.steer,
                                config: {
                                  ...settings.config.steer.config,
                                  style: v,
                                },
                              },
                            })
                          }
                        />

                        <SettingSelectRow<'dark' | 'light'>
                          title="Wheel Color"
                          value={settings.config.steer.config.color ?? 'light'}
                          options={[
                            { label: 'Light', value: 'light' },
                            { label: 'Dark', value: 'dark' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              steer: {
                                ...settings.config.steer,
                                config: {
                                  ...settings.config.steer.config,
                                  color: v,
                                },
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Gear Settings */}
                  <SettingsSection title="Gear">
                    <SettingToggleRow
                      title="Enable Gear Display"
                      enabled={settings.config.gear.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          gear: { ...settings.config.gear, enabled: newValue },
                        })
                      }
                    />

                    {settings.config.gear.enabled && (
                      <SettingsSection>
                        <SettingSliderRow
                          title="Gear Display Scale"
                          description="Relative size of the gear number display"
                          value={settings.config.gear.size ?? 100}
                          units="%"
                          min={50}
                          max={150}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              gear: { ...settings.config.gear, size: v },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Speed"
                          description="Show the current speed beneath the gear number"
                          enabled={settings.config.gear.showspeed}
                          onToggle={(newValue) =>
                            handleConfigChange({
                              gear: {
                                ...settings.config.gear,
                                showspeed: newValue,
                              },
                            })
                          }
                        />

                        {settings.config.gear.showspeed && (
                          <SettingsSection>
                            <SettingButtonGroupRow<'auto' | 'mph' | 'km/h'>
                              title="Speed Unit"
                              value={settings.config.gear.unit ?? 'auto'}
                              options={[
                                { label: 'Auto', value: 'auto' },
                                { label: 'MPH', value: 'mph' },
                                { label: 'KM/H', value: 'km/h' },
                              ]}
                              onChange={(v) =>
                                handleConfigChange({
                                  gear: { ...settings.config.gear, unit: v },
                                })
                              }
                            />

                            <SettingToggleRow
                              title="Show Speed Unit Label"
                              enabled={settings.config.gear.showspeedunit}
                              onToggle={(newValue) =>
                                handleConfigChange({
                                  gear: {
                                    ...settings.config.gear,
                                    showspeedunit: newValue,
                                  },
                                })
                              }
                            />
                          </SettingsSection>
                        )}
                      </SettingsSection>
                    )}
                  </SettingsSection>
                </>
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
