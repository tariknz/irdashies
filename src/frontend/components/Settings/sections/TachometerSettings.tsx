import { useEffect, useState } from 'react';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type SettingsTabType,
  type TachometerConfig,
  type TachometerWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingSliderRow } from '../components/SettingSliderRow';

const defaultConfig = getWidgetDefaultConfig('tachometer');

export const TachometerSettings = () => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => (widget.type ?? widget.id) === 'tachometer'
  );
  const [settings, setSettings] = useState<TachometerWidgetSettings>({
    enabled: saved?.enabled ?? false,
    config: deepMergeConfig(
      defaultConfig as unknown as Record<string, unknown>,
      saved?.config
    ) as unknown as TachometerConfig,
  });
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('tachometerTab') as SettingsTabType) ?? 'display'
  );

  useEffect(
    () => localStorage.setItem('tachometerTab', activeTab),
    [activeTab]
  );
  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Tachometer"
      description="Configure the RPM and engine-temperature display."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="tachometer"
    >
      {(handleConfigChange) => {
        const config = settings.config;
        const oilEnabled = config.oilTemp?.enabled ?? true;
        const oilPosition = config.oilTemp?.position ?? 'top';
        const oilOffset = config.oilTemp?.edgeOffset ?? 0;
        const waterEnabled = config.waterTemp?.enabled ?? true;
        const waterPosition = config.waterTemp?.position ?? 'top';
        const waterOffset = config.waterTemp?.edgeOffset ?? 0;
        return (
          <div className="space-y-6">
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

            {activeTab === 'display' && (
              <SettingsSection title="Display">
                <SettingSliderRow
                  title="Background Opacity"
                  value={config.background.opacity}
                  units="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(opacity) =>
                    handleConfigChange({ background: { opacity } })
                  }
                />
                <SettingToggleRow
                  title="Show RPM Text"
                  enabled={config.showRpmText}
                  onToggle={(showRpmText) =>
                    handleConfigChange({ showRpmText })
                  }
                />
                <SettingButtonGroupRow<'horizontal' | 'top' | 'bottom'>
                  title="RPM Position"
                  value={config.rpmOrientation ?? 'horizontal'}
                  options={[
                    { label: 'Right', value: 'horizontal' },
                    { label: 'Top', value: 'top' },
                    { label: 'Bottom', value: 'bottom' },
                  ]}
                  onChange={(rpmOrientation) =>
                    handleConfigChange({ rpmOrientation })
                  }
                />
                <SettingDivider />
                <SettingToggleRow
                  title="Show Oil Temperature"
                  enabled={oilEnabled}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      oilTemp: {
                        enabled,
                        position: oilPosition,
                        edgeOffset: oilOffset,
                      },
                    })
                  }
                />
                {oilEnabled && (
                  <SettingsSection>
                    <SettingButtonGroupRow<'top' | 'bottom'>
                      title="Oil Position"
                      value={oilPosition}
                      options={[
                        { label: 'Top', value: 'top' },
                        { label: 'Bottom', value: 'bottom' },
                      ]}
                      onChange={(position) =>
                        handleConfigChange({
                          oilTemp: {
                            enabled: true,
                            position,
                            edgeOffset: oilOffset,
                          },
                        })
                      }
                    />
                    <SettingSliderRow
                      title="Oil Edge Offset"
                      value={oilOffset}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(edgeOffset) =>
                        handleConfigChange({
                          oilTemp: {
                            enabled: true,
                            position: oilPosition,
                            edgeOffset,
                          },
                        })
                      }
                    />
                  </SettingsSection>
                )}
                <SettingToggleRow
                  title="Show Water Temperature"
                  enabled={waterEnabled}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      waterTemp: {
                        enabled,
                        position: waterPosition,
                        edgeOffset: waterOffset,
                      },
                    })
                  }
                />
                {waterEnabled && (
                  <SettingsSection>
                    <SettingButtonGroupRow<'top' | 'bottom'>
                      title="Water Position"
                      value={waterPosition}
                      options={[
                        { label: 'Top', value: 'top' },
                        { label: 'Bottom', value: 'bottom' },
                      ]}
                      onChange={(position) =>
                        handleConfigChange({
                          waterTemp: {
                            enabled: true,
                            position,
                            edgeOffset: waterOffset,
                          },
                        })
                      }
                    />
                    <SettingSliderRow
                      title="Water Edge Offset"
                      value={waterOffset}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(edgeOffset) =>
                        handleConfigChange({
                          waterTemp: {
                            enabled: true,
                            position: waterPosition,
                            edgeOffset,
                          },
                        })
                      }
                    />
                  </SettingsSection>
                )}
                {(oilEnabled || waterEnabled) && (
                  <SettingToggleRow
                    title="Swap Oil/Water Sides"
                    enabled={config.tempLayout?.swapSides ?? false}
                    onToggle={(swapSides) =>
                      handleConfigChange({ tempLayout: { swapSides } })
                    }
                  />
                )}
              </SettingsSection>
            )}

            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">
                <SessionVisibility
                  sessionVisibility={config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
                <SettingDivider />
                <SettingToggleRow
                  title="Show only when on track"
                  enabled={config.showOnlyWhenOnTrack}
                  onToggle={(showOnlyWhenOnTrack) =>
                    handleConfigChange({ showOnlyWhenOnTrack })
                  }
                />
              </SettingsSection>
            )}
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
