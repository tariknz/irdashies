import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FasterCarsFromBehindWidgetSettings,
  SettingsTabType,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { useDashboard } from '@irdashies/context';
import { useFasterCarsSettings } from '../../FasterCarsFromBehind/hooks/useFasterCarsSettings';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'fastercarsfrombehind';

export const FasterCarsFromBehindSettings = () => {
  const { currentDashboard } = useDashboard();
  const fasterCarsSettings = useFasterCarsSettings();
  const [settings, setSettings] = useState<FasterCarsFromBehindWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config: fasterCarsSettings as FasterCarsFromBehindWidgetSettings['config'],
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('fasterCarsFromBehindTab') as SettingsTabType) ||
      'display'
  );

  useEffect(() => {
    localStorage.setItem('fasterCarsFromBehindTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Faster Cars From Behind"
      description="Configure settings for the faster cars detection widget."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="fastercarsfrombehind"
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
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
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
                <SettingsSection title="Display">
                  {/* Distance Threshold */}
                  <SettingSliderRow
                    title="Distance Threshold"
                    description="Minimum gap to a faster car before it is displayed. Smaller values
                    show cars that are closer behind you."
                    value={Math.abs(settings.config.distanceThreshold)}
                    units="seconds"
                    min={0.3}
                    max={20}
                    step={0.1}
                    onChange={(v) =>
                      handleConfigChange({ distanceThreshold: v })
                    }
                  />

                  {/* Show Distance Section */}
                  <SettingProp path="showDistance" />

                  {/* Show Name Section */}
                  <SettingProp path="showName" />

                  {settings.config.showName && (
                    <SettingsSection>
                      <SettingProp path="removeNumbersFromName" />
                    </SettingsSection>
                  )}

                  {/* Show Badge Section */}
                  <SettingProp path="showBadge" />

                  {/* Badge Format Selector */}
                  {settings.config.showBadge && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-3 justify-end">
                        {(
                          [
                            'license-color-fullrating-combo',
                            'fullrating-color-no-license',
                            'rating-color-no-license',
                            'license-color-fullrating-bw',
                            'license-color-rating-bw',
                            'rating-only-color-rating-bw',
                            'license-color-rating-bw-no-license',
                            'license-bw-rating-bw',
                            'rating-only-bw-rating-bw',
                            'license-bw-rating-bw-no-license',
                            'rating-bw-no-license',
                            'fullrating-bw-no-license',
                          ] as const
                        ).map((format) => (
                          <BadgeFormatPreview
                            key={format}
                            format={format}
                            selected={settings.config.badgeFormat === format}
                            onClick={() => {
                              handleConfigChange({
                                badgeFormat: format,
                              });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <SettingProp path="numberDriversBehind" />

                  <SettingProp path="alignDriverBoxes" />

                  <SettingProp path="closestDriverBox" />

                  {/* Only Show Faster Classes Section */}
                  <SettingProp path="onlyShowFasterClasses" />
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
