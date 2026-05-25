import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  getWidgetDefaultConfig,
  type InputTraceWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';

const SETTING_ID = 'inputtrace';
const defaultConfig = getWidgetDefaultConfig('inputtrace');

export const InputTraceSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as InputTraceWidgetSettings | undefined;
  const [settings, setSettings] = useState<InputTraceWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as InputTraceWidgetSettings['config']) ??
      defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Input Trace"
      description="Standalone pedal and steering trace visualization."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <SettingsSection title="Traces">
            <SettingToggleRow
              title="Throttle"
              enabled={settings.config.trace.includeThrottle}
              onToggle={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, includeThrottle: v },
                })
              }
            />
            <SettingToggleRow
              title="Brake"
              enabled={settings.config.trace.includeBrake}
              onToggle={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, includeBrake: v },
                })
              }
            />
            <SettingToggleRow
              title="Clutch"
              enabled={settings.config.trace.includeClutch}
              onToggle={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, includeClutch: v },
                })
              }
            />
            <SettingToggleRow
              title="ABS overlay"
              enabled={settings.config.trace.includeAbs}
              onToggle={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, includeAbs: v },
                })
              }
            />
            <SettingToggleRow
              title="Steering"
              enabled={settings.config.trace.includeSteer ?? true}
              onToggle={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, includeSteer: v },
                })
              }
            />
            <SettingDivider />
            <SettingSliderRow
              title="Stroke width"
              value={settings.config.trace.strokeWidth ?? 3}
              min={1}
              max={8}
              step={1}
              onChange={(v) =>
                handleConfigChange({
                  trace: { ...settings.config.trace, strokeWidth: v },
                })
              }
            />
          </SettingsSection>

          <SettingsSection title="Display">
            <SettingSliderRow
              title="Background opacity"
              value={settings.config.background.opacity}
              min={0}
              max={100}
              step={5}
              onChange={(v) =>
                handleConfigChange({ background: { opacity: v } })
              }
            />
            <SettingDivider />
            <SettingToggleRow
              title="Use Raw Inputs"
              description="Disables iRacing's automated input processing, showing direct pedal telemetry without assists like auto-clutch or anti-stall."
              enabled={settings.config.useRawValues}
              onToggle={(v) => handleConfigChange({ useRawValues: v })}
            />
          </SettingsSection>

          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />

            <SettingDivider />

            <SettingToggleRow
              title="Show only when on track"
              description="Hide the widget when not driving"
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(v) => handleConfigChange({ showOnlyWhenOnTrack: v })}
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
};
