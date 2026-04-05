import { useDashboard } from '@irdashies/context';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useSortableList } from '../../SortableList';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
import {
  InputWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';

const SETTING_ID = 'input';

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

const defaultConfig = getWidgetDefaultConfig('input');

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
          </div>
        );
      })}
    </div>
  );
};

export const InputSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as InputWidgetSettings | undefined;
  const [settings, setSettings] = useState<InputWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as InputWidgetSettings['config']) ?? defaultConfig,
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('inputTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('inputTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Input Traces"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="input"
    >
      {(handleConfigChange) => {
        const handleDisplayOrderChange = (newOrder: string[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };

        const config = settings.config;

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
                  <SettingsSection title="Options">
                    <SettingToggleRow
                      title="Use Raw Inputs"
                      description="Disables iRacing's automated input processing, showing direct pedal telemetry without assists like auto-clutch or anti-stall."
                      enabled={config.useRawValues}
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
                      enabled={config.trace.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          trace: { ...config.trace, enabled },
                        })
                      }
                    />

                    {config.trace.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Trace"
                          enabled={config.trace.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Trace"
                          enabled={config.trace.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Trace"
                          enabled={config.trace.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS"
                          enabled={config.trace.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeAbs: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Steering Trace"
                          enabled={config.trace.includeSteer ?? true}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeSteer: enabled,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Stroke Width"
                          value={config.trace.strokeWidth ?? 3}
                          units="px"
                          min={0}
                          max={10}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                strokeWidth: v,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Max Samples"
                          value={config.trace.maxSamples ?? 40}
                          units=" samples"
                          min={40}
                          max={1000}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
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
                      enabled={config.bar.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({ bar: { ...config.bar, enabled } })
                      }
                    />

                    {config.bar.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Bar"
                          enabled={config.bar.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Bar"
                          enabled={config.bar.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Bar"
                          enabled={config.bar.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS Indicator"
                          enabled={config.bar.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
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
                      enabled={config.abs?.enabled ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          abs: { ...config.abs, enabled: newValue },
                        })
                      }
                    />
                  </SettingsSection>

                  {/* Steer Settings */}
                  <SettingsSection title="Steer">
                    <SettingToggleRow
                      title="Enable Steer Display"
                      enabled={config.steer.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          steer: { ...config.steer, enabled: newValue },
                        })
                      }
                    />

                    {config.steer.enabled && (
                      <SettingsSection>
                        <SettingSelectRow<
                          'default' | 'formula' | 'lmp' | 'nascar' | 'ushape'
                        >
                          title="Wheel Style"
                          value={config.steer.config.style ?? 'default'}
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
                                ...config.steer,
                                config: { ...config.steer.config, style: v },
                              },
                            })
                          }
                        />

                        <SettingSelectRow<'dark' | 'light'>
                          title="Wheel Color"
                          value={config.steer.config.color ?? 'light'}
                          options={[
                            { label: 'Light', value: 'light' },
                            { label: 'Dark', value: 'dark' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              steer: {
                                ...config.steer,
                                config: { ...config.steer.config, color: v },
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
                      enabled={config.gear.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          gear: { ...config.gear, enabled: newValue },
                        })
                      }
                    />

                    {config.gear.enabled && (
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
                              gear: { ...config.gear, size: v },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Speed"
                          description="Show the current speed beneath the gear number"
                          enabled={config.gear.showspeed}
                          onToggle={(newValue) =>
                            handleConfigChange({
                              gear: { ...config.gear, showspeed: newValue },
                            })
                          }
                        />

                        {config.gear.showspeed && (
                          <SettingsSection>
                            <SettingButtonGroupRow<'auto' | 'mph' | 'km/h'>
                              title="Speed Unit"
                              value={config.gear.unit ?? 'auto'}
                              options={[
                                { label: 'Auto', value: 'auto' },
                                { label: 'MPH', value: 'mph' },
                                { label: 'KM/H', value: 'km/h' },
                              ]}
                              onChange={(v) =>
                                handleConfigChange({
                                  gear: { ...config.gear, unit: v },
                                })
                              }
                            />

                            <SettingToggleRow
                              title="Show Speed Unit Label"
                              enabled={config.gear.showspeedunit}
                              onToggle={(newValue) =>
                                handleConfigChange({
                                  gear: {
                                    ...config.gear,
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
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingDivider />

                  <SettingToggleRow
                    title="Show only when on track"
                    description="If enabled, inputs will only be shown when driving"
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
