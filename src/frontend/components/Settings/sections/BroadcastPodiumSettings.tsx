import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastPodiumWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'broadcastpodium';

const defaultConfig = getWidgetDefaultConfig('broadcastpodium');

export const BroadcastPodiumSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastPodiumWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastPodiumWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Broadcast Podium"
      description="The top three of each class on steps, up after the checkered flag of a race. Demo mode shows it all the time so it can be placed."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingsSection title="Options">
          <SettingSliderRow
            title="Background Opacity"
            value={settings.config.background.opacity}
            units="%"
            min={0}
            max={100}
            step={1}
            onChange={(v) => handleConfigChange({ background: { opacity: v } })}
          />
        </SettingsSection>
      )}
    </BaseSettingsSection>
  );
};
