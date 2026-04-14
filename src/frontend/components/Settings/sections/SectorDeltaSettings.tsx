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
import { SettingSelectRow } from '../components/SettingSelectRow';

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
                  <SettingSliderRow
                    title="Background Opacity"
                    description="Opacity of the widget background."
                    value={settings.config.background.opacity}
                    units="%"
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      handleConfigChange({ background: { opacity: v } })
                    }
                  />
                  <SettingSelectRow
                    title="Time Format"
                    description="Format for displaying sector times and deltas."
                    value={settings.config.timeFormat ?? 'full'}
                    options={[
                      { label: '1:42.123', value: 'full' },
                      { label: '1:42.1', value: 'mixed' },
                      { label: '1:42', value: 'minutes' },
                      { label: '42.123', value: 'seconds-full' },
                      { label: '42.1', value: 'seconds-mixed' },
                      { label: '42', value: 'seconds' },
                    ]}
                    onChange={(v) => handleConfigChange({ timeFormat: v })}
                  />
                  <SettingSelectRow
                    title="Comparison Source"
                    description="Choose what to compare sector times against."
                    value={settings.config.ghostComparison ?? 'prefer-ghost'}
                    options={[
                      { label: 'Ghost When Available', value: 'prefer-ghost' },
                      {
                        label: 'Session Best Only',
                        value: 'session-best-only',
                      },
                    ]}
                    onChange={(v) => handleConfigChange({ ghostComparison: v })}
                  />
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
                            settings.config.thresholds?.green ?? DEFAULT_GREEN;
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

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, widget will only be shown when driving."
                  enabled={settings.config.showOnlyWhenOnTrack}
                  onToggle={(v) =>
                    handleConfigChange({ showOnlyWhenOnTrack: v })
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
