import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type StintPlanWidgetSettings,
} from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';
import { WidgetScaleSettings } from '../components/WidgetScaleSettings';

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
  const [settings, setSettings] = useState(() => fromSaved(savedSettings));

  // useState only reads its initialiser once; follow the saved config when the
  // dashboard loads after mount.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) setSettings(fromSaved(savedSettings));
  }

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Stint Plan"
      description="Where your car stands against the race plan: stint, box lap, fuel target, who drives next and how far off the plan you are. Needs a race plan from Settings, Race Plan."
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
          <WidgetScaleSettings widgetId={SETTING_ID} className="px-4" />
          <SettingsSection title="Display">
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
