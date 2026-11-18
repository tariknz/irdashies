import { useId, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { HeartRateWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'heartrate';

const defaultConfig = getWidgetDefaultConfig('heartrate');

export const HeartRateSettings = () => {
  const fieldId = useId();
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as HeartRateWidgetSettings | undefined;

  const [settings, setSettings] = useState<HeartRateWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: savedSettings?.config ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Heart Rate"
      description="Display your live heart rate via HypeRate — no API key needed."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingsSection title="HypeRate" scaleWidgetId={SETTING_ID}>
          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-session`}
              className="text-sm text-slate-300"
            >
              Session ID
            </label>
            <input
              type="text"
              id={`${fieldId}-session`}
              aria-describedby={`${fieldId}-session-help`}
              value={settings.config.deviceId}
              placeholder="e.g. KiY"
              onChange={(e) =>
                handleConfigChange({ deviceId: e.target.value.trim() })
              }
              className="settings-field w-full"
            />
            <p
              id={`${fieldId}-session-help`}
              className="text-sm text-slate-400"
            >
              Use the code at the end of your HypeRate share link, for example
              KiY.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-theme`}
              className="text-sm text-slate-300"
            >
              Widget / theme <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              id={`${fieldId}-theme`}
              aria-describedby={`${fieldId}-theme-help`}
              value={settings.config.widgetUrl}
              placeholder="e.g. Bouncing_Heart_Widget"
              onChange={(e) =>
                handleConfigChange({ widgetUrl: e.target.value.trim() })
              }
              className="settings-field w-full"
            />
            <p id={`${fieldId}-theme-help`} className="text-sm text-slate-400">
              Paste a HypeRate widget link or name. Your Session ID is filled in
              automatically; leave blank for the default animated heart.
            </p>
          </div>
        </SettingsSection>
      )}
    </BaseSettingsSection>
  );
};
