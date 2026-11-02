import { useEffect, useState } from 'react';
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
}: ChannelFieldProps) => (
  <div className="space-y-2">
    <label className="text-md text-slate-300">{label}</label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.trim())}
      className="w-full rounded border-slate-600 bg-slate-700 p-2 text-slate-300"
    />
    {error ? (
      <p className="text-sm text-red-400">{error}</p>
    ) : (
      <p className="text-sm text-slate-500">{description}</p>
    )}
  </div>
);

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
    return <>Loading...</>;
  }

  const twitchChannel = settings.config.twitch?.channel ?? '';
  const youtubeChannel = settings.config.youtube?.channel ?? '';

  return (
    <BaseSettingsSection
      title="Stream Chat"
      description="Show live Twitch and YouTube chat in one overlay."
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
            <div className="flex border-b border-slate-700/50">
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
              </TabButton>
              <TabButton
                id="twitch"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                icon={
                  <TwitchLogoIcon size={18} weight="fill" color="#a970ff" />
                }
              >
                Twitch
              </TabButton>
              <TabButton
                id="youtube"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                icon={
                  <YoutubeLogoIcon size={18} weight="fill" color="#ff0000" />
                }
              >
                YouTube
              </TabButton>
            </div>

            {activeTab === 'display' && (
              <>
                <SettingsSection title="Display">
                  <SettingProp path="display.background.opacity" />
                  <SettingProp path="display.fontSize" />
                  <SettingProp path="display.showPlatformIcons" />
                </SettingsSection>

                <SettingsSection title="Automatic message disappearance">
                  <SettingProp path="display.autoHide.enabled" />
                  {(settings.config.display?.autoHide?.enabled ?? false) && (
                    <SettingProp path="display.autoHide.intervalSeconds" />
                  )}
                </SettingsSection>
              </>
            )}

            {activeTab === 'twitch' && (
              <SettingsSection title="Twitch">
                <ChannelField
                  label="Twitch channel:"
                  value={twitchChannel}
                  placeholder="channelname"
                  description="Name of the Twitch channel to read chat from. Leave empty to turn Twitch chat off."
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
              <SettingsSection title="YouTube">
                <ChannelField
                  label="YouTube channel:"
                  value={youtubeChannel}
                  placeholder="@channelname"
                  description="Handle of the YouTube channel, starting with @. Chat connects while the channel is live. Leave empty to turn YouTube chat off."
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
