import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { changeMarker } from '../components/ChangedMark';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type {
  BroadcastPodiumStyle,
  BroadcastPodiumWidgetSettings,
} from '@irdashies/types';

const SETTING_ID = 'broadcastpodium';

const defaultConfig = getWidgetDefaultConfig('broadcastpodium');

const STYLE_OPTIONS: { label: string; value: BroadcastPodiumStyle }[] = [
  { label: 'Steps', value: 'steps' },
  { label: 'Trophies', value: 'trophy' },
];

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
      {(handleConfigChange) => {
        const mark = changeMarker(
          settings.config,
          defaultConfig,
          handleConfigChange
        );
        return (
          <SettingsSection title="Options">
            {mark(
              ['style'],
              <SettingButtonGroupRow<BroadcastPodiumStyle>
                title="Style"
                description="Gold, silver and bronze steps, or a trophy for each place."
                value={settings.config.style}
                options={STYLE_OPTIONS}
                onChange={(v) => handleConfigChange({ style: v })}
              />
            )}
            {mark(
              ['background'],
              <SettingSliderRow
                title="Background Opacity"
                value={settings.config.background.opacity}
                units="%"
                min={0}
                max={100}
                step={1}
                onChange={(v) =>
                  handleConfigChange({ background: { opacity: v } })
                }
              />
            )}
          </SettingsSection>
        );
      }}
    </BaseSettingsSection>
  );
};
