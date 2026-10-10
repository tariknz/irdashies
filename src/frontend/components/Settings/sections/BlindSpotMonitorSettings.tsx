import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  BlindSpotMonitorWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { HIGHLIGHT_COLOR_PRESETS } from './GeneralSettings';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig = getWidgetDefaultConfig('blindspotmonitor');

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BlindSpotMonitorWidgetSettings | undefined;
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as BlindSpotMonitorWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('bsmTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('bsmTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Blind Spot Monitor"
      description="Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side."
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
                <SettingsSection title="Display">
                  {/* Display Mode */}
                  <SettingProp path="displayMode" />

                  {/* Standard settings */}
                  {(settings.config.displayMode ?? 'standard') ===
                    'standard' && (
                    <>
                      <SettingProp path="background.opacity" />
                      <SettingProp path="width" />
                      <SettingProp path="borderSize" />
                      <div className="flex items-center justify-between gap-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            Indicator Color
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded border-2"
                            style={{
                              width: '20px',
                              height: '20px',
                              backgroundColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                              borderColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                            }}
                          />
                          <select
                            value={settings.config.indicatorColor ?? 16096779}
                            onChange={(e) =>
                              handleConfigChange({
                                indicatorColor: parseInt(e.target.value),
                              })
                            }
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          >
                            {Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(
                              ([key, value]) => (
                                <option key={key} value={key}>
                                  {value}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Simple settings */}
                  {settings.config.displayMode === 'simple' && (
                    <>
                      <SettingProp path="simpleSize" />
                      <SettingProp path="simpleVerticalPosition" />
                      <SettingProp path="simpleShowCount" />
                      <SettingDivider />
                      <SettingProp path="thresholdColorsEnabled" />
                      {!(settings.config.thresholdColorsEnabled ?? false) && (
                        <div className="flex items-center justify-between gap-4 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              Square Colour
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded border-2"
                              style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                                borderColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                              }}
                            />
                            <select
                              value={settings.config.indicatorColor ?? 16096779}
                              onChange={(e) =>
                                handleConfigChange({
                                  indicatorColor: parseInt(e.target.value),
                                })
                              }
                              className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            >
                              {Array.from(
                                HIGHLIGHT_COLOR_PRESETS.entries()
                              ).map(([key, value]) => (
                                <option key={key} value={key}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      {(settings.config.thresholdColorsEnabled ?? false) && (
                        <>
                          <div className="flex items-center justify-between gap-4 py-2">
                            <p className="text-sm text-slate-400">
                              1 car colour
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded border-2"
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  backgroundColor: `#${(settings.config.thresholdColor1 ?? 16096779).toString(16).padStart(6, '0')}`,
                                  borderColor: `#${(settings.config.thresholdColor1 ?? 16096779).toString(16).padStart(6, '0')}`,
                                }}
                              />
                              <select
                                value={
                                  settings.config.thresholdColor1 ?? 16096779
                                }
                                onChange={(e) =>
                                  handleConfigChange({
                                    thresholdColor1: parseInt(e.target.value),
                                  })
                                }
                                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              >
                                {Array.from(
                                  HIGHLIGHT_COLOR_PRESETS.entries()
                                ).map(([key, value]) => (
                                  <option key={key} value={key}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-2">
                            <p className="text-sm text-slate-400">
                              2+ cars colour
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded border-2"
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  backgroundColor: `#${(settings.config.thresholdColor2 ?? 15680580).toString(16).padStart(6, '0')}`,
                                  borderColor: `#${(settings.config.thresholdColor2 ?? 15680580).toString(16).padStart(6, '0')}`,
                                }}
                              />
                              <select
                                value={
                                  settings.config.thresholdColor2 ?? 15680580
                                }
                                onChange={(e) =>
                                  handleConfigChange({
                                    thresholdColor2: parseInt(e.target.value),
                                  })
                                }
                                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              >
                                {Array.from(
                                  HIGHLIGHT_COLOR_PRESETS.entries()
                                ).map(([key, value]) => (
                                  <option key={key} value={key}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </SettingsSection>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Options">
                  {/* Distance Ahead */}
                  <SettingProp path="distAhead" />

                  {/* Distance Behind */}
                  <SettingProp path="distBehind" />
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
