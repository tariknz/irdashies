import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingsSection } from '../components/SettingSection';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';

export const TwitchChatSettings = () => {
  const { settings, setSettings } = useWidgetSettingsSection('twitchchat');

  return (
    <BaseSettingsSection
      title="Twitch Chat"
      description="Configure Twitch chat overlay settings."
      widgetType={'twitchchat'}
      settings={settings}
      onSettingsChange={setSettings}
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
