import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  SectorDeltaWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingProp, SettingProps } from '../components/SettingProp';

const DEFAULT_GREEN = 0.5;
const DEFAULT_YELLOW = 1.0;

const SETTING_ID = 'sectordelta';

const defaultConfig = getWidgetDefaultConfig('sectordelta');

export const SectorDeltaSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as SectorDeltaWidgetSettings | undefined;

  const [settings, setSettings] = useState<SectorDeltaWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as SectorDeltaWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('sectorDeltaTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('sectorDeltaTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Sector Delta"
      description="Per-sector timing deltas colored by performance."
      settings={settings as SectorDeltaWidgetSettings}
      onSettingsChange={(s) => setSettings(s as SectorDeltaWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
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
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Display">
                    <SettingProp path="background.opacity" />
                    <SettingProp path="timeFormat" />
                    <SettingProp path="ghostComparison" />
                    <SettingProp path="trackIncidentSectors" />
                    <SettingProp path="alwaysScroll" />
                    <SettingToggleRow
                      title="Limit visible sectors"
                      description="Show only a fixed number of sectors at once. On tracks with more sectors, the widget becomes a sliding carousel centered on your current sector."
                      enabled={settings.config.maxSectorsShown != null}
                      onToggle={(v) =>
                        handleConfigChange({
                          maxSectorsShown: v ? 5 : undefined,
                        })
                      }
                    />
                    {settings.config.maxSectorsShown != null && (
                      <SettingSliderRow
                        title="Max Sectors Shown"
                        description="Number of sector cards visible at once. The current sector is centered in the window."
                        value={settings.config.maxSectorsShown}
                        min={3}
                        max={12}
                        step={1}
                        onChange={(v) =>
                          handleConfigChange({ maxSectorsShown: v })
                        }
                      />
                    )}
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Color Thresholds">
                    <SettingToggleRow
                      title="Customize thresholds"
                      description="Override the default color thresholds (green: 0.5%, yellow: 1.0%)."
                      enabled={settings.config.thresholds != null}
                      onToggle={(v) =>
                        handleConfigChange({
                          thresholds: v
                            ? {
                                green:
                                  settings.config.thresholds?.green ??
                                  DEFAULT_GREEN,
                                yellow:
                                  settings.config.thresholds?.yellow ??
                                  DEFAULT_YELLOW,
                              }
                            : undefined,
                        })
                      }
                    />

                    {settings.config.thresholds != null && (
                      <>
                        <SettingSliderRow
                          title="Green limit"
                          description="Sectors within this % of session best show green."
                          value={
                            settings.config.thresholds.green ?? DEFAULT_GREEN
                          }
                          units="%"
                          min={0.1}
                          max={5}
                          step={0.1}
                          onChange={(v) => {
                            const currentYellow =
                              settings.config.thresholds?.yellow ??
                              DEFAULT_YELLOW;
                            const newYellow =
                              v >= currentYellow
                                ? Math.min(5, Math.round((v + 0.1) * 10) / 10)
                                : currentYellow;
                            handleConfigChange({
                              thresholds: {
                                ...settings.config.thresholds,
                                green: v,
                                yellow: newYellow,
                              },
                            });
                          }}
                        />
                        <SettingSliderRow
                          title="Yellow limit"
                          description="Sectors within this % of session best show yellow. Above = red."
                          value={
                            settings.config.thresholds.yellow ?? DEFAULT_YELLOW
                          }
                          units="%"
                          min={0.1}
                          max={5}
                          step={0.1}
                          onChange={(v) => {
                            const currentGreen =
                              settings.config.thresholds?.green ??
                              DEFAULT_GREEN;
                            const newGreen =
                              v <= currentGreen
                                ? Math.max(0.1, Math.round((v - 0.1) * 10) / 10)
                                : currentGreen;
                            handleConfigChange({
                              thresholds: {
                                ...settings.config.thresholds,
                                green: newGreen,
                                yellow: v,
                              },
                            });
                          }}
                        />
                      </>
                    )}
                  </SettingsSection>
                </>
              )}

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
