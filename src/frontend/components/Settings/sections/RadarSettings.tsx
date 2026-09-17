import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type RadarWidgetSettings,
} from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'radar';
const defaultConfig = getWidgetDefaultConfig(SETTING_ID);

export const RadarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === SETTING_ID
  ) as RadarWidgetSettings | undefined;
  const [settings, setSettings] = useState<RadarWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: savedSettings?.config ?? defaultConfig,
  });

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Radar (LMU only)"
      description="Shows true nearby-car position and heading from Le Mans Ultimate shared memory. It remains hidden in iRacing."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <SettingsSection title="Display">
            <SettingNumberRow
              title="Range"
              description="Visible distance in every direction."
              value={settings.config.range}
              min={5}
              max={100}
              step={1}
              onChange={(range) => handleConfigChange({ range })}
            />
            <SettingNumberRow
              title="Vehicle width"
              value={settings.config.markerWidth}
              min={1}
              max={5}
              step={0.1}
              onChange={(markerWidth) => handleConfigChange({ markerWidth })}
            />
            <SettingNumberRow
              title="Vehicle length"
              value={settings.config.markerLength}
              min={2}
              max={10}
              step={0.1}
              onChange={(markerLength) => handleConfigChange({ markerLength })}
            />
            <SettingToggleRow
              title="Show vehicle orientation"
              enabled={settings.config.showOrientation}
              onToggle={(showOrientation) =>
                handleConfigChange({ showOrientation })
              }
            />
            <SettingSliderRow
              title="Background opacity"
              value={settings.config.background.opacity}
              units="%"
              min={0}
              max={100}
              step={5}
              onChange={(opacity) =>
                handleConfigChange({ background: { opacity } })
              }
            />
          </SettingsSection>
          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />
            <SettingToggleRow
              title="Show only when on track"
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(showOnlyWhenOnTrack) =>
                handleConfigChange({ showOnlyWhenOnTrack })
              }
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
};
