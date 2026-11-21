import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TachometerWidgetSettings,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { CustomShiftPointsSection } from '../components/CustomShiftPointsSection';

const SETTING_ID = 'tachometer';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig('tachometer');

export const TachometerSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TachometerWidgetSettings | undefined;
  const settings: TachometerWidgetSettings = {
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as TachometerWidgetSettings['config']) ??
      defaultConfig,
  };

  const [activeTab, setActiveTab] = useStoredTab('tachometerTab', [
    'display',
    'options',
    'visibility',
  ]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Tachometer"
      description="Configure the tachometer."
      settings={settings}
      widgetId="tachometer"
    >
      {(handleConfigChange) => {
        const config = settings.config;
        // Defaulted temp display state so the toggle and the position section
        // stay in sync on existing dashboards where these are still undefined.
        const oilTempEnabled = config.oilTemp?.enabled ?? true;
        const oilTempPosition = config.oilTemp?.position ?? 'top';
        const oilTempEdgeOffset = config.oilTemp?.edgeOffset ?? 0;
        const waterTempEnabled = config.waterTemp?.enabled ?? true;
        const waterTempPosition = config.waterTemp?.position ?? 'top';
        const waterTempEdgeOffset = config.waterTemp?.edgeOffset ?? 0;
        const tempSwapSides = config.tempLayout?.swapSides ?? false;
        const anyTempEnabled = oilTempEnabled || waterTempEnabled;
        return (
          <SettingProps
            widget={SETTING_ID}
            config={settings.config}
            onChange={handleConfigChange}
          >
            <div className="space-y-6">
              {/* Tabs */}
              <SettingsTabBar>
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
                  Custom Shift Points
                </TabButton>
                <TabButton
                  id="visibility"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Visibility
                </TabButton>
              </SettingsTabBar>

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                    <SettingProp path="background.opacity" />

                    <SettingProp path="showRpmText" />

                    {config.showRpmText && (
                      <SettingsSection>
                        <SettingProp path="rpmOrientation" />
                      </SettingsSection>
                    )}
                    <SettingDivider />

                    <SettingToggleRow
                      title="Show Oil Temperature"
                      enabled={oilTempEnabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          oilTemp: {
                            enabled: newValue,
                            position: oilTempPosition,
                            edgeOffset: oilTempEdgeOffset,
                          },
                        })
                      }
                    />

                    {oilTempEnabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'top' | 'bottom'>
                          title="Oil Position"
                          value={oilTempPosition}
                          options={[
                            { label: 'Top', value: 'top' },
                            { label: 'Bottom', value: 'bottom' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              oilTemp: {
                                enabled: oilTempEnabled,
                                position: v,
                                edgeOffset: oilTempEdgeOffset,
                              },
                            })
                          }
                        />
                        <SettingSliderRow
                          title="Oil Edge Offset"
                          value={oilTempEdgeOffset}
                          units="%"
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              oilTemp: {
                                enabled: oilTempEnabled,
                                position: oilTempPosition,
                                edgeOffset: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}

                    <SettingToggleRow
                      title="Show Water Temperature"
                      enabled={waterTempEnabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          waterTemp: {
                            enabled: newValue,
                            position: waterTempPosition,
                            edgeOffset: waterTempEdgeOffset,
                          },
                        })
                      }
                    />

                    {waterTempEnabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'top' | 'bottom'>
                          title="Water Position"
                          value={waterTempPosition}
                          options={[
                            { label: 'Top', value: 'top' },
                            { label: 'Bottom', value: 'bottom' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              waterTemp: {
                                enabled: waterTempEnabled,
                                position: v,
                                edgeOffset: waterTempEdgeOffset,
                              },
                            })
                          }
                        />
                        <SettingSliderRow
                          title="Water Edge Offset"
                          value={waterTempEdgeOffset}
                          units="%"
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              waterTemp: {
                                enabled: waterTempEnabled,
                                position: waterTempPosition,
                                edgeOffset: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}

                    {anyTempEnabled && (
                      <SettingToggleRow
                        title="Swap Oil/Water Sides"
                        enabled={tempSwapSides}
                        onToggle={(newValue) =>
                          handleConfigChange({
                            tempLayout: { swapSides: newValue },
                          })
                        }
                      />
                    )}
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Custom Shift Points">
                  <CustomShiftPointsSection
                    shiftPoints={config.shiftPointSettings}
                    onChange={(shiftPointSettings) =>
                      handleConfigChange({ shiftPointSettings })
                    }
                    enableDescription="If enabled, custom shift points will be displayed on the tachometer"
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

                  <SettingProp path="showOnlyWhenOnTrack" />
                </SettingsSection>
              )}
            </div>
          </SettingProps>
        );
      }}
    </BaseSettingsSection>
  );
};
