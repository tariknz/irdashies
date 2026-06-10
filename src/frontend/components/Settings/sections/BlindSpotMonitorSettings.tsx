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
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { HIGHLIGHT_COLOR_PRESETS } from './GeneralSettings';

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
                <SettingSelectRow
                  title="Display Mode"
                  description="Visual style of the blind spot indicator."
                  value={settings.config.displayMode ?? 'standard'}
                  options={[
                    { label: 'Standard', value: 'standard' },
                    { label: 'Simple', value: 'simple' },
                  ]}
                  onChange={(v) => handleConfigChange({ displayMode: v })}
                />

                {/* Standard settings */}
                {(settings.config.displayMode ?? 'standard') === 'standard' && (
                  <>
                    <SettingSliderRow
                      title="Background Opacity"
                      value={settings.config.background?.opacity ?? 30}
                      units="%"
                      min={0}
                      max={100}
                      step={5}
                      onChange={(v) =>
                        handleConfigChange({ background: { opacity: v } })
                      }
                    />
                    <SettingSliderRow
                      title="Width"
                      description="Width of the blind spot indicator in pixels."
                      value={settings.config.width ?? 20}
                      units="px"
                      min={5}
                      max={100}
                      step={1}
                      onChange={(v) => handleConfigChange({ width: v })}
                    />
                    <SettingSliderRow
                      title="Border Size"
                      description="Border thickness of the blind spot indicator in pixels."
                      value={settings.config.borderSize ?? 1}
                      units="px"
                      min={0}
                      max={20}
                      step={1}
                      onChange={(v) => handleConfigChange({ borderSize: v })}
                    />
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
                    <SettingSliderRow
                      title="Square Size"
                      description="Width and height of the indicator square in pixels."
                      value={settings.config.simpleSize ?? 44}
                      units="px"
                      min={20}
                      max={120}
                      step={1}
                      onChange={(v) => handleConfigChange({ simpleSize: v })}
                    />
                    <SettingSliderRow
                      title="Vertical Position"
                      description="Vertical placement within the widget. 0% = top, 50% = centre, 100% = bottom."
                      value={settings.config.simpleVerticalPosition ?? 50}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ simpleVerticalPosition: v })
                      }
                    />
                    <SettingToggleRow
                      title="Show Count"
                      description="Display the number of cars inside the indicator square."
                      enabled={settings.config.simpleShowCount ?? true}
                      onToggle={(v) =>
                        handleConfigChange({ simpleShowCount: v })
                      }
                    />
                    <SettingDivider />
                    <SettingToggleRow
                      title="Colour by Car Count"
                      description="Use different colours based on how many cars are in your blind spot."
                      enabled={settings.config.thresholdColorsEnabled ?? false}
                      onToggle={(v) =>
                        handleConfigChange({ thresholdColorsEnabled: v })
                      }
                    />
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
                    )}
                    {(settings.config.thresholdColorsEnabled ?? false) && (
                      <>
                        <div className="flex items-center justify-between gap-4 py-2">
                          <p className="text-sm text-slate-400">1 car colour</p>
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
                <SettingSliderRow
                  title="Distance Ahead"
                  description="Distance to car ahead in meters."
                  value={settings.config.distAhead ?? 20}
                  units="m"
                  min={3}
                  max={6}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ distAhead: v })}
                />

                {/* Distance Behind */}
                <SettingSliderRow
                  title="Distance Behind"
                  description="Distance to car behind in meters."
                  value={settings.config.distBehind ?? 20}
                  units="m"
                  min={3}
                  max={6}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ distBehind: v })}
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
                  description="If enabled, blind spotter will only be shown when driving"
                  enabled={settings.config.showOnlyWhenOnTrack ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showOnlyWhenOnTrack: newValue })
                  }
                />
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
