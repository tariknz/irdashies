import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import type { TwitchChatWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'twitchchat';

const defaultConfig: TwitchChatWidgetSettings['config'] = {
  fontSize: 16,
  background: { opacity: 30 },
  channel: '',
};

const migrateConfig = (
  savedConfig: unknown
): TwitchChatWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    fontSize: (config.fontSize as number) ?? defaultConfig.fontSize,
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ??
        defaultConfig.background.opacity,
    },
    channel: (config.channel as string) ?? defaultConfig.channel,
  };
};

export const TwitchChatSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TwitchChatWidgetSettings | undefined;
  const [settings, setSettings] = useState<TwitchChatWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Twitch Chat"
      description="Configure Twitch chat overlay settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <>
          <SettingsSection title="Display">
            {/* Background Opacity */}
            <SettingSliderRow
              title="Background Opacity"
              value={settings.config.background?.opacity ?? 30}
              units="%"
              min={0}
              max={100}
              step={5}
              onChange={(v) =>
                handleConfigChange({
                  background: { opacity: v },
                })
              }
            />

            {/* Font size */}
            <SettingSliderRow
              title="Font size"
              value={settings.config.fontSize ?? 16}
              units="px"
              min={8}
              max={45}
              step={1}
              onChange={(v) =>
                handleConfigChange({
                  fontSize: v,
                })
              }
            />
          </SettingsSection>

          <SettingsSection title="Channel">
            {/* Twitch channel name */}
            <div className="space-y-2">
              <label className="text-md text-slate-300">Twitch channel:</label>
              <input
                type="text"
                value={settings.config.channel}
                onChange={(e) =>
                  handleConfigChange({ channel: e.target.value })
                }
                className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              />
              <p className="text-sm text-slate-500">
                Name of Twitch channel to display chat from
              </p>
            </div>
          </SettingsSection>
        </>
      )}
    </BaseSettingsSection>
  );
};
