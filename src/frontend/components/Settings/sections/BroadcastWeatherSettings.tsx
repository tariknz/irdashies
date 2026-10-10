import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { changeMarker } from '../components/ChangedMark';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastWeatherWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'broadcastweather';

const defaultConfig = getWidgetDefaultConfig('broadcastweather');

export const BroadcastWeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastWeatherWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastWeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;

  return (
    <BaseSettingsSection
      title="Broadcast Weather"
      description="Pops up with an animated card when rain starts or stops, the track gets wetter or dries, or track temperature swings by 3 degrees."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const mark = changeMarker(config, defaultConfig, handleConfigChange);
        return (
          <div className="space-y-4">
            <SettingsSection title="Options">
              {mark(
                ['background'],
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
              )}
              {mark(
                ['intervalMinutes'],
                <SettingSliderRow
                  title="Also Every (0 = Only On Change)"
                  value={config.intervalMinutes}
                  units="min"
                  min={0}
                  max={30}
                  step={1}
                  onChange={(v) => handleConfigChange({ intervalMinutes: v })}
                />
              )}
              {mark(
                ['showSeconds'],
                <SettingSliderRow
                  title="Show For"
                  value={config.showSeconds}
                  units="s"
                  min={5}
                  max={30}
                  step={1}
                  onChange={(v) => handleConfigChange({ showSeconds: v })}
                />
              )}
            </SettingsSection>

            <SettingsSection title="Visibility">
              {mark(
                ['sessionVisibility'],
                <SessionVisibility
                  sessionVisibility={config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
              )}
            </SettingsSection>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
