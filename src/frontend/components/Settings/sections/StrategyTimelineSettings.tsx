import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type StrategyTimelineWidgetSettings,
} from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';
import { WidgetScaleSettings } from '../components/WidgetScaleSettings';

const SETTING_ID = 'strategytimeline';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig(SETTING_ID);

const fromSaved = (
  saved: StrategyTimelineWidgetSettings | undefined
): StrategyTimelineWidgetSettings => ({
  id: SETTING_ID,
  enabled: saved?.enabled ?? false,
  config: saved?.config ?? defaultConfig,
});

export const StrategyTimelineSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as StrategyTimelineWidgetSettings | undefined;
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
      title="Strategy Timeline"
      description="The team's view of the race plan: who drives when, projected against the race so far, with clashes against driver availability. It can also be docked in the Gantry. Needs a race plan from Settings, Race Plan."
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
            <SettingProp path="showStrip" />
            <SettingProp path="showDoneStints" />
            <SettingProp path="showStops" />
            <SettingProp path="background.opacity" />
          </SettingsSection>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
