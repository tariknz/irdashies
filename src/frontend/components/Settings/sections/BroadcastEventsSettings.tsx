import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type {
  BroadcastEventsConfig,
  BroadcastEventsWidgetSettings,
} from '@irdashies/types';

const SETTING_ID = 'broadcastevents';

const defaultConfig = getWidgetDefaultConfig('broadcastevents');

const KIND_LABELS: Record<keyof BroadcastEventsConfig['kinds'], string> = {
  crash: 'Incidents (crash, impact)',
  slowdown: 'Slow / stopped car',
  offTrack: 'Off track',
  blackFlag: 'Black flag',
  yellow: 'Yellow flag',
  caution: 'Full course yellow',
  fastestLap: 'Fastest lap in class',
  pitStop: 'Pit stop (pit lane time)',
  meatball: 'Meatball (repair) flag',
  disqualified: 'Disqualified',
  finalLap: 'Final lap (white flag)',
  checkered: 'Checkered flag with winner',
};

export const BroadcastEventsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastEventsWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastEventsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;
  // Configs saved before a kind existed lack it; show those as on.
  const kinds = { ...defaultConfig.kinds, ...config.kinds };

  return (
    <BaseSettingsSection
      title="Broadcast Events"
      description="Race control popups for the stream: incidents, yellow and black flags, with a card for the driver involved. Uses the Gantry incident detector and its thresholds."
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
            <SettingSliderRow
              title="Show Each Event For"
              value={config.showSeconds}
              units="s"
              min={3}
              max={20}
              step={1}
              onChange={(v) => handleConfigChange({ showSeconds: v })}
            />
          </SettingsSection>

          <SettingsSection title="Events">
            {(
              Object.keys(
                KIND_LABELS
              ) as (keyof BroadcastEventsConfig['kinds'])[]
            ).map((kind) => (
              <SettingToggleRow
                key={kind}
                title={KIND_LABELS[kind]}
                enabled={kinds[kind]}
                onToggle={(v) =>
                  handleConfigChange({ kinds: { ...kinds, [kind]: v } })
                }
              />
            ))}
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
