import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  DeltaSpeedWidgetSettings,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'deltaspeed';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig('deltaspeed');

export const DeltaSpeedSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as DeltaSpeedWidgetSettings | undefined;

  const settings: DeltaSpeedWidgetSettings = {
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as DeltaSpeedWidgetSettings['config']) ??
      defaultConfig,
  };

  const [activeTab, setActiveTab] = useStoredTab('deltaSpeedTab', [
    'options',
    'visibility',
  ]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Delta Speed"
      description="Live speed difference against your session best clean lap at this point on track."
      settings={settings as DeltaSpeedWidgetSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            <SettingsTabBar>
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
            </SettingsTabBar>

            <div>
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                    <SettingProp path="background.opacity" />
                    <SettingSelectRow
                      title="Units"
                      description="Unit for the numeric readout. Auto follows iRacing's own display units setting."
                      value={settings.config.unit ?? 'km/h'}
                      options={[
                        { label: 'km/h', value: 'km/h' },
                        { label: 'mph', value: 'mph' },
                        { label: 'Auto', value: 'auto' },
                      ]}
                      onChange={(v) => handleConfigChange({ unit: v })}
                    />
                    <SettingProp path="scaleKph" />
                    <SettingProp path="scaleMph" />
                    <SettingProp path="capKph" />
                    <SettingProp path="capMph" />
                    <SettingProp path="updateThresholdKph" />
                    <SettingProp path="updateThresholdMph" />
                    <SettingProp path="showNumber" />
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
