import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import {
  FlatTrackMapWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'flatmap';

const defaultConfig = getWidgetDefaultConfig('flatmap');

export const FlatTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FlatTrackMapWidgetSettings | undefined;
  const [settings, setSettings] = useState<FlatTrackMapWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config:
      (savedSettings?.config as FlatTrackMapWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('flatTrackMapTab') as SettingsTabType) || 'track'
  );

  useEffect(() => {
    localStorage.setItem('flatTrackMapTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Flat Track Map"
      description="Configure flat track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="flatmap"
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
                id="track"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Track
              </TabButton>
              <TabButton
                id="drivers"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Drivers
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
              {/* TRACK TAB */}
              {activeTab === 'track' && (
                <SettingsSection title="Track Settings">
                  <SettingProp path="trackLineWidth" />

                  <SettingProp path="trackOutlineWidth" />

                  <SettingProp path="invertTrackColors" />
                </SettingsSection>
              )}

              {/* DRIVERS TAB */}
              {activeTab === 'drivers' && (
                <SettingsSection title="Driver Circles">
                  <SettingProp path="showCarNumbers" />

                  {settings.config.showCarNumbers && (
                    <SettingsSection>
                      <SettingProp path="displayMode" />
                    </SettingsSection>
                  )}

                  <SettingProp path="driverCircleSize" />

                  <SettingProp path="playerCircleSize" />

                  <SettingProp path="trackmapFontSize" />

                  <SettingProp path="useHighlightColor" />

                  <SettingProp path="invertLeaderColor" />
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

                  <SettingProp path="showOnlyWhenOnTrack" />
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
