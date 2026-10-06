import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastTickerWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'broadcastticker';

const defaultConfig = getWidgetDefaultConfig('broadcastticker');

export const BroadcastTickerSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastTickerWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastTickerWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;

  return (
    <BaseSettingsSection
      title="Broadcast Ticker"
      description="Scrolling bottom-of-screen ticker. After each full loop it moves on: standings, fastest laps, then the best car of each manufacturer."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <SettingsSection title="Options">
            <SettingSliderRow
              title="Background Opacity"
              value={config.background.opacity}
              units="%"
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                handleConfigChange({ background: { opacity: v } })
              }
            />
            <SettingToggleRow
              title="Translucent"
              description="Fade the whole widget, text included, so it hides less of the stream."
              enabled={config.translucent.enabled}
              onToggle={(v) =>
                handleConfigChange({
                  translucent: { ...config.translucent, enabled: v },
                })
              }
            />
            {config.translucent.enabled && (
              <SettingSliderRow
                title="Widget Opacity"
                value={config.translucent.opacity}
                units="%"
                min={20}
                max={100}
                step={5}
                onChange={(v) =>
                  handleConfigChange({
                    translucent: { ...config.translucent, opacity: v },
                  })
                }
              />
            )}
            <SettingSliderRow
              title="Seconds Per Car"
              value={config.secondsPerEntry}
              units="s"
              min={1}
              max={10}
              step={0.5}
              onChange={(v) => handleConfigChange({ secondsPerEntry: v })}
            />
          </SettingsSection>

          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
};
