import { t } from '@irdashies/frontend/i18n';
import { useEffect, useId, useState } from 'react';
import { TwitchLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import type {
  SettingsTabType,
  StreamChatWidgetSettings,
} from '@irdashies/types';
import {
  getWidgetDefaultConfig,
  TWITCH_CHANNEL_PATTERN,
  YOUTUBE_HANDLE_PATTERN,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { TabButton } from '../components/TabButton';

const SETTING_ID = 'streamchat';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig('streamchat');

const TAB_STORAGE_KEY = 'streamChatTab';
const TABS: readonly SettingsTabType[] = ['display', 'twitch', 'youtube'];

const readStoredTab = (): SettingsTabType => {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.find((tab) => tab === stored) ?? 'display';
  } catch {
    return 'display';
  }
};

interface ChannelFieldProps {
  label: string;
  value: string;
  placeholder: string;
  description: string;
  error?: string;
  onChange: (value: string) => void;
}

const ChannelField = ({
  label,
  value,
  placeholder,
  description,
  error,
  onChange,
}: ChannelFieldProps) => {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm text-slate-300">
        {t(label)}
      </label>
      <input
        id={id}
        aria-describedby={`${id}-help`}
        aria-invalid={!!error}
        type="text"
        value={value}
        placeholder={t(placeholder)}
        onChange={(e) => onChange(e.target.value.trim())}
        className="settings-field w-full"
      />
      {error ? (
        <p id={`${id}-help`} role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="text-sm text-slate-400">
          {t(description)}
        </p>
      )}
    </div>
  );
};

export const StreamChatSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as StreamChatWidgetSettings | undefined;
  const [settings, setSettings] = useState<StreamChatWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: {
      ...defaultConfig,
      ...(savedSettings?.config as Partial<StreamChatWidgetSettings['config']>),
    },
  });
  const [activeTab, setActiveTab] = useState<SettingsTabType>(readStoredTab);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {
      // Remembering the tab is a convenience; it can fail in private windows.
    }
  }, [activeTab]);

  if (!currentDashboard) {
    return <>{t('Loading...')}</>;
  }

  const twitchChannel = settings.config.twitch?.channel ?? '';
  const youtubeChannel = settings.config.youtube?.channel ?? '';

  return (
    <BaseSettingsSection
      title={t('Stream Chat')}
      description={t('Show live Twitch and YouTube chat in one overlay.')}
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
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                {t('Display')}
              </TabButton>
              <TabButton
                id="twitch"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                icon={
                  <TwitchLogoIcon size={18} weight="fill" color="#a970ff" />
                }
              >
                {t('Twitch')}
              </TabButton>
              <TabButton
                id="youtube"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                icon={
                  <YoutubeLogoIcon size={18} weight="fill" color="#ff0000" />
                }
              >
                {t('YouTube')}
              </TabButton>
            </div>

            {activeTab === 'display' && (
              <div className="space-y-5">
                <SettingsSection title={t('Display')}>
                  <SettingProp path="display.background.opacity" />
                  <SettingProp path="display.fontSize" />
                  <SettingProp path="display.showPlatformIcons" />
                </SettingsSection>

                <SettingsSection title={t('Message visibility')}>
                  <SettingProp path="display.autoHide.enabled" />
                  {(settings.config.display?.autoHide?.enabled ?? false) && (
                    <SettingProp path="display.autoHide.intervalSeconds" />
                  )}
                </SettingsSection>
              </div>
            )}

            {activeTab === 'twitch' && (
              <SettingsSection title={t('Twitch')}>
                <ChannelField
                  label={t('Twitch channel:')}
                  value={twitchChannel}
                  placeholder={t('channelname')}
                  description={t(
                    'Name of the Twitch channel to read chat from. Leave empty to turn Twitch chat off.'
                  )}
                  error={
                    twitchChannel && !TWITCH_CHANNEL_PATTERN.test(twitchChannel)
                      ? 'Use the channel name only: letters, digits and underscore.'
                      : undefined
                  }
                  onChange={(channel) =>
                    handleConfigChange({
                      twitch: { ...settings.config.twitch, channel },
                    })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'youtube' && (
              <SettingsSection title={t('YouTube')}>
                <ChannelField
                  label={t('YouTube channel:')}
                  value={youtubeChannel}
                  placeholder={t('@channelname')}
                  description={t(
                    'Handle of the YouTube channel, starting with @. Chat connects while the channel is live. Leave empty to turn YouTube chat off.'
                  )}
                  error={
                    youtubeChannel &&
                    !YOUTUBE_HANDLE_PATTERN.test(youtubeChannel)
                      ? 'Enter the handle with a leading @, for example @channelname.'
                      : undefined
                  }
                  onChange={(channel) =>
                    handleConfigChange({
                      youtube: { ...settings.config.youtube, channel },
                    })
                  }
                />
              </SettingsSection>
            )}
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
