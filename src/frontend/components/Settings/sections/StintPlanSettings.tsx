import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type StintPlanWidgetSettings,
} from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'stintplan';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig(SETTING_ID);

const fromSaved = (
  saved: StintPlanWidgetSettings | undefined
): StintPlanWidgetSettings => ({
  id: SETTING_ID,
  enabled: saved?.enabled ?? false,
  config: saved?.config ?? defaultConfig,
});

export const StintPlanSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as StintPlanWidgetSettings | undefined;
  const settings = fromSaved(savedSettings);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Stint Plan"
      description="Where your car stands against the race plan: stint, box lap, fuel target, who drives next and how far off the plan you are. Needs a race plan from Settings, Race Plan."
      settings={settings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
            <SettingProp path="showElapsedTime" />
            <SettingProp path="showFuel" />
            <SettingProp path="showNextDriver" />
            <SettingProp path="background.opacity" />
          </SettingsSection>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
