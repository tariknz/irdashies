import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { HeartRateWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'heartrate';

const defaultConfig = getWidgetDefaultConfig('heartrate');

export const HeartRateSettings = () => {
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
        <SettingsSection title="HypeRate">
          <div className="space-y-2">
            <label className="text-md text-slate-300">Session ID</label>
            <input
              type="text"
              value={settings.config.deviceId}
              placeholder="e.g. KiY"
              onChange={(e) =>
                handleConfigChange({ deviceId: e.target.value.trim() })
              }
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
            />
            <p className="text-sm text-slate-500">
              The code at the end of your HypeRate share link
              (app.hyperate.io/<span className="text-slate-300">KiY</span>). No
              account or API key required.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-md text-slate-300">
              Widget / theme <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={settings.config.widgetUrl}
              placeholder="e.g. Bouncing_Heart_Widget"
              onChange={(e) =>
                handleConfigChange({ widgetUrl: e.target.value.trim() })
              }
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
            />
            <p className="text-sm text-slate-500">
              Pick a widget on hyperate.io and paste its link or just the name —
              e.g.{' '}
              <span className="text-slate-300">Bouncing_Heart_Widget</span> or{' '}
              <span className="text-slate-300">
                app.hyperate.io/animation/59/YOUR-ID-HERE
              </span>
              . Your Session ID is filled in automatically. Leave blank for the
              default animated heart.
            </p>
          </div>
        </SettingsSection>
      )}
    </BaseSettingsSection>
  );
};
