import { memo, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  GantryWidgetSettings,
  GantryConfig,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'gantry';

const defaultConfig = getWidgetDefaultConfig('gantry');

type ThresholdKey =
  | 'slowSpeedThreshold'
  | 'slowFrameThreshold'
  | 'suddenStopFromSpeed'
  | 'suddenStopToSpeed'
  | 'suddenStopFrames'
  | 'offTrackDebounce'
  | 'cooldownSeconds';

const thresholdFields: {
  key: ThresholdKey;
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

  if (!currentDashboard) return null;

  const config = settings.config;

  return (
    <div className="flex flex-col gap-4">
      <BaseSettingsSection
        title="Incident Detection"
        description="Configure thresholds used to detect incidents on track."
        settings={settings}
        onSettingsChange={setSettings}
        widgetId={SETTING_ID}
        disableInternalScroll
        onConfigChange={(newConfig) => {
          const merged = { ...config, ...newConfig };
          const thresholds = {
            slowSpeedThreshold: merged.slowSpeedThreshold,
            slowFrameThreshold: merged.slowFrameThreshold,
            suddenStopFromSpeed: merged.suddenStopFromSpeed,
            suddenStopToSpeed: merged.suddenStopToSpeed,
            suddenStopFrames: merged.suddenStopFrames,
            offTrackDebounce: merged.offTrackDebounce,
            cooldownSeconds: merged.cooldownSeconds,
          };
          window.raceControlBridge?.updateThresholds(thresholds);
        }}
      >
        {(handleConfigChange) => (
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
                  value={config[key]}
                  onChange={(e) =>
                    handleConfigChange({ [key]: Number(e.target.value) })
                  }
                  className="w-16 bg-slate-700 rounded px-1 py-0.5 text-right"
                />
              </label>
            ))}
          </div>
        )}
      </BaseSettingsSection>

      <BaseSettingsSection
        title="Session Retention"
        description="Configure how many past sessions to keep in the Gantry overlay."
        settings={settings}
        onSettingsChange={setSettings}
        widgetId={SETTING_ID}
        disableInternalScroll
        onConfigChange={(newConfig) => {
          const merged = { ...config, ...newConfig };
          window.raceControlBridge?.updateRetention(merged.sessionRetention);
        }}
      >
        {(handleConfigChange) => (
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
        )}
      </BaseSettingsSection>
    </div>
  );
});
GantrySettings.displayName = 'GantrySettings';
