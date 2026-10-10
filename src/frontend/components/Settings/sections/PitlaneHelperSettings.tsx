import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import type {
  PitlaneHelperWidgetSettings,
  SettingsTabType,
} from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'pitlanehelper';

const defaultConfig = getWidgetDefaultConfig('pitlanehelper');

export const PitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as PitlaneHelperWidgetSettings | undefined;

  const [settings, setSettings] = useState<PitlaneHelperWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as PitlaneHelperWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('pitLaneTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('pitLaneTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Pitlane Helper"
      description="Assists with pit entry by showing speed delta, pitbox position, and warnings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
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
              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <>
                  {/* Display Settings */}
                  <SettingsSection title="Options">
                    <SettingToggleRow
                      title="Show when approaching pit"
                      description="Display overlay before entering pit lane"
                      enabled={settings.config.showMode === 'approaching'}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          showMode: enabled ? 'approaching' : 'onPitRoad',
                        })
                      }
                    />

                    {settings.config.showMode === 'approaching' && (
                      <SettingsSection>
                        <SettingProp path="approachDistance" />
                      </SettingsSection>
                    )}

                    <SettingProp path="showSpeedSummary" />

                    {settings.config.showSpeedSummary && (
                      <SettingsSection>
                        <SettingProp path="showSpeedDelta" />

                        <SettingProp path="speedLimitStyle" />

                        <SettingProp path="speedUnit" />
                      </SettingsSection>
                    )}

                    <SettingProp path="showSpeedBar" />

                    {settings.config.showSpeedBar && (
                      <SettingsSection>
                        <SettingProp path="speedBarOrientation" />
                      </SettingsSection>
                    )}

                    <SettingProp path="showProgressBar" />

                    {settings.config.showProgressBar && (
                      <SettingsSection>
                        <SettingProp path="progressBarOrientation" />

                        <SettingProp path="showPastPitBox" />
                      </SettingsSection>
                    )}

                    <SettingProp path="background.opacity" />
                  </SettingsSection>

                  {/* Warning Settings */}
                  <SettingsSection title="Warnings">
                    <SettingProp path="enablePitLimiterWarning" />

                    <SettingProp path="showPitlaneTraffic" />

                    <SettingProp path="enableEarlyPitboxWarning" />

                    {settings.config.enableEarlyPitboxWarning && (
                      <SettingsSection>
                        <SettingProp path="earlyPitboxThreshold" />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Pit Exit Inputs Settings */}
                  <SettingsSection title="Pit Exit Inputs">
                    <SettingProp path="showPitExitInputs" />

                    {settings.config.showPitExitInputs && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Throttle"
                          enabled={
                            settings.config.pitExitInputs?.throttle ?? true
                          }
                          onToggle={(newValue) =>
                            handleConfigChange({
                              pitExitInputs: {
                                clutch:
                                  settings.config.pitExitInputs?.clutch ?? true,
                                throttle: newValue,
                              },
                            })
                          }
                        />
                        <SettingToggleRow
                          title="Show Clutch"
                          enabled={
                            settings.config.pitExitInputs?.clutch ?? true
                          }
                          onToggle={(newValue) =>
                            handleConfigChange({
                              pitExitInputs: {
                                throttle:
                                  settings.config.pitExitInputs?.throttle ??
                                  true,
                                clutch: newValue,
                              },
                            })
                          }
                        />
                        <SettingProp path="showInputsPhase" />
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
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
