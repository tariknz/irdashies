import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  LapTimeLogWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';

const SETTING_ID = 'laptimelog';

const defaultConfig = getWidgetDefaultConfig('laptimelog');

export const LapTimeLogSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as LapTimeLogWidgetSettings | undefined;
  const [settings, setSettings] = useState<LapTimeLogWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as LapTimeLogWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('lapTimeTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('lapTimeTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Lap Timer"
      description="Configure settings for the Lap Timer widget. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
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
              <>
                <SettingsSection title="Display">
                  <SettingToggleRow
                    title="Show Current Lap"
                    description="Display the live lap time for the current lap."
                    enabled={settings.config.showCurrentLap ?? true}
                    onToggle={(newValue) =>
                      handleConfigChange({ showCurrentLap: newValue })
                    }
                  />

                  <SettingToggleRow
                    title="Show Predicted Lap"
                    description="Show the current predicted lap based on the current delta time."
                    enabled={settings.config.showPredictedLap ?? true}
                    onToggle={(newValue) =>
                      handleConfigChange({ showPredictedLap: newValue })
                    }
                  />

                  <SettingToggleRow
                    title="Show Last Lap"
                    description="Show the driver's last lap time."
                    enabled={settings.config.showLastLap ?? true}
                    onToggle={(newValue) =>
                      handleConfigChange({ showLastLap: newValue })
                    }
                  />

                  <SettingToggleRow
                    title="Show Best Lap"
                    description="Show the driver's best lap time."
                    enabled={settings.config.showBestLap ?? true}
                    onToggle={(newValue) =>
                      handleConfigChange({ showBestLap: newValue })
                    }
                  />

                  <SettingToggleRow
                    title="Display Lap Delta"
                    description="Choose which lap to base the delta calculation on. This can be the driver's last lap, best lap, or the overall session best lap."
                    enabled={settings.config.delta?.enabled ?? true}
                    onToggle={(v) =>
                      handleConfigChange({
                        ...settings.config,
                        delta: {
                          ...settings.config.delta,
                          enabled: v,
                        },
                      })
                    }
                  />

                  {settings.config.delta?.enabled && (
                    <SettingsSection>
                      <SettingButtonGroupRow<'lastlap' | 'bestlap'>
                        title="Delta Calculation Base Lap"
                        value={settings.config.delta?.method ?? 'bestlap'}
                        options={[
                          { label: 'Last Lap', value: 'lastlap' },
                          { label: 'Best Lap', value: 'bestlap' },
                        ]}
                        onChange={(v) =>
                          handleConfigChange({
                            delta: {
                              ...settings.config.delta,
                              method: v,
                            },
                          })
                        }
                      />
                    </SettingsSection>
                  )}

                  <SettingToggleRow
                    title="Show Lap History"
                    description="Show the driver's lap history. You can configure how many to show below."
                    enabled={settings.config.history?.enabled ?? true}
                    onToggle={(v) =>
                      handleConfigChange({
                        ...settings.config,
                        history: {
                          ...settings.config.history,
                          enabled: v,
                        },
                      })
                    }
                  />

                  {settings.config.history?.enabled && (
                    <SettingsSection>
                      <SettingSelectRow
                        title="Number Of Laps To Show"
                        value={(
                          settings.config.history?.count ?? 10
                        ).toString()}
                        options={Array.from({ length: 10 }, (_, i) => {
                          const num = i + 1;
                          return {
                            label: num.toString(),
                            value: num.toString(),
                          };
                        })}
                        onChange={(v) =>
                          handleConfigChange({
                            ...settings.config,
                            history: {
                              ...settings.config.history,
                              count: parseInt(v),
                            },
                          })
                        }
                      />
                    </SettingsSection>
                  )}
                </SettingsSection>
              </>
            )}

            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <SettingsSection title="Options">
                {/* Background Opacity */}
                <SettingSliderRow
                  title="Background Opacity"
                  value={settings.config.background?.opacity ?? 30}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({
                      background: { opacity: v },
                    })
                  }
                />

                {/* Foreground Opacity */}
                <SettingSliderRow
                  title="Foreground Opacity"
                  value={settings.config.foreground?.opacity ?? 30}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({
                      foreground: { opacity: v },
                    })
                  }
                />

                {/* Scale */}
                <SettingSliderRow
                  title="Scale"
                  description="Adjust the size of the font by adjusting this widget's scale"
                  value={settings.config.scale ?? 1}
                  units="%"
                  min={50}
                  max={150}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({
                      scale: v,
                    })
                  }
                />

                <SettingToggleRow
                  title="Reverse Order"
                  description="Display the lap time elements in reverse order"
                  enabled={settings.config.reverse ?? false}
                  onToggle={(v) =>
                    handleConfigChange({
                      reverse: v,
                    })
                  }
                />

                <SettingButtonGroupRow<'top' | 'bottom'>
                  title="Widget Alignment"
                  value={settings.config.alignment ?? 'top'}
                  options={[
                    { label: 'Top', value: 'top' },
                    { label: 'Bottom', value: 'bottom' },
                  ]}
                  onChange={(v) =>
                    handleConfigChange({
                      alignment: v,
                    })
                  }
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
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
