import { memo, useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  GantryWidgetSettings,
  GantryConfig,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'gantry';

const defaultConfig = getWidgetDefaultConfig('gantry');

const thresholdFields: {
  key: keyof GantryConfig;
  label: string;
  min: number;
  max: number;
}[] = [
  {
    key: 'slowSpeedThreshold',
    label: 'Slow speed threshold (km/h)',
    min: 1,
    max: 100,
  },
  {
    key: 'slowFrameThreshold',
    label: 'Slow frame count',
    min: 1,
    max: 60,
  },
  {
    key: 'suddenStopFromSpeed',
    label: 'Sudden stop: from speed (km/h)',
    min: 20,
    max: 300,
  },
  {
    key: 'suddenStopToSpeed',
    label: 'Sudden stop: to speed (km/h)',
    min: 1,
    max: 50,
  },
  {
    key: 'suddenStopFrames',
    label: 'Sudden stop: frame window',
    min: 1,
    max: 10,
  },
  {
    key: 'offTrackDebounce',
    label: 'Off-track debounce (frames)',
    min: 1,
    max: 10,
  },
  {
    key: 'cooldownSeconds',
    label: 'Per-type cooldown (seconds)',
    min: 1,
    max: 30,
  },
];

export const GantrySettings = memo(() => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as GantryWidgetSettings | undefined;
  const [settings, setSettings] = useState<GantryWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as GantryWidgetSettings['config']) ??
      defaultConfig,
  });

  useEffect(() => {
    const config = settings.config;
    const thresholds = {
      slowSpeedThreshold: config.slowSpeedThreshold,
      slowFrameThreshold: config.slowFrameThreshold,
      suddenStopFromSpeed: config.suddenStopFromSpeed,
      suddenStopToSpeed: config.suddenStopToSpeed,
      suddenStopFrames: config.suddenStopFrames,
      offTrackDebounce: config.offTrackDebounce,
      cooldownSeconds: config.cooldownSeconds,
    };
    window.raceControlBridge?.updateThresholds(thresholds);
    window.raceControlBridge?.updateRetention(config.sessionRetention);
  }, [settings.config]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Gantry"
      description="Configure incident detection thresholds and session retention for the Gantry race control overlay."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const config = settings.config;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200">
                Incident Detection
              </h3>
              <div className="flex flex-col gap-2">
                {thresholdFields.map(({ key, label, min, max }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between text-xs text-slate-300"
                  >
                    <span>{label}</span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={config[key] as number}
                      onChange={(e) =>
                        handleConfigChange({ [key]: Number(e.target.value) })
                      }
                      className="w-16 bg-slate-700 rounded px-1 py-0.5 text-right"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200">
                Session Retention
              </h3>
              <label className="flex items-center justify-between text-xs text-slate-300">
                <span>Keep sessions</span>
                <select
                  value={config.sessionRetention}
                  onChange={(e) =>
                    handleConfigChange({
                      sessionRetention: e.target
                        .value as GantryConfig['sessionRetention'],
                    })
                  }
                  className="bg-slate-700 rounded px-2 py-0.5 text-xs"
                >
                  <option value="all">All</option>
                  <option value={5}>Last 5</option>
                  <option value={10}>Last 10</option>
                  <option value={20}>Last 20</option>
                </select>
              </label>
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
});
GantrySettings.displayName = 'GantrySettings';
