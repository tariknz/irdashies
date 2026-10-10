import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  DeltaSpeedWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'deltaspeed';

const defaultConfig = getWidgetDefaultConfig('deltaspeed');

export const DeltaSpeedSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as DeltaSpeedWidgetSettings | undefined;

  const [settings, setSettings] = useState<DeltaSpeedWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as DeltaSpeedWidgetSettings['config']) ??
      defaultConfig,
  });

  // useState only reads its initialiser on the first render, and the Loading
  // return below does not re-run it. Mounting before the dashboard has loaded —
  // or switching profile — would otherwise leave this holding defaults, and
  // BaseSettingsSection persists the whole settings object, so the next edit to
  // any one control would write those defaults over the saved config. Re-seed
  // whenever the saved widget changes, using the same guarded
  // set-during-render sync as BaseSettingsSection so there is no stale paint.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        id: SETTING_ID,
        enabled: savedSettings.enabled ?? false,
        config:
          (savedSettings.config as DeltaSpeedWidgetSettings['config']) ??
          defaultConfig,
      });
    }
  }

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('deltaSpeedTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('deltaSpeedTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Delta Speed"
      description="Live speed difference against your session best clean lap at this point on track."
      settings={settings as DeltaSpeedWidgetSettings}
      onSettingsChange={(s) => setSettings(s as DeltaSpeedWidgetSettings)}
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
                <SettingsSection title="Display">
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
