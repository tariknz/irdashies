import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import type { TwitchChatWidgetSettings } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'twitchchat';

const defaultConfig = getWidgetDefaultConfig('twitchchat');

export const TwitchChatSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TwitchChatWidgetSettings | undefined;
  const [settings, setSettings] = useState<TwitchChatWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as TwitchChatWidgetSettings['config']) ??
      defaultConfig,
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
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <>
            <SettingsSection title="Display">
              {/* Background Opacity */}
              <SettingProp path="background.opacity" />

              {/* Font size */}
              <SettingProp path="fontSize" />
            </SettingsSection>

            <SettingsSection title="Automatic message disappearance">
              <SettingProp path="autoHide.enabled" />
              {(settings.config.autoHide?.enabled ?? false) && (
                <SettingProp path="autoHide.intervalSeconds" />
              )}
            </SettingsSection>

            <SettingsSection title="Channel">
              {/* Twitch channel name */}
              <div className="space-y-2">
                <label className="text-md text-slate-300">
                  Twitch channel:
                </label>
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
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
