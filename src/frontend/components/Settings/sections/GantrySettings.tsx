import { memo, useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  GantryWidgetSettings,
  GantryConfig,
  SessionRetention,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard, useTrackStateSelector } from '@irdashies/context';
import type { TrackStateSnapshot } from '@irdashies/types';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import {
  kphFromSpeed,
  resolveSpeedUnit,
  speedFromKph,
  type SpeedUnit,
} from '@irdashies/utils/units';

const SETTING_ID = 'gantry';

const selectDisplayUnits = (snapshot: TrackStateSnapshot) =>
  snapshot.displayUnits;

// Thresholds are stored in km/h; only the inputs convert. Bounds round inward
// so a converted bound always lands back inside the stored range.
const toDisplay = (kph: number, unit: SpeedUnit) =>
  Math.round(speedFromKph(kph, unit));
const fromDisplay = (value: number, unit: SpeedUnit) =>
  Math.round(kphFromSpeed(value, unit));
const minToDisplay = (kph: number, unit: SpeedUnit) =>
  Math.ceil(speedFromKph(kph, unit));
const maxToDisplay = (kph: number, unit: SpeedUnit) =>
  Math.floor(speedFromKph(kph, unit));

const defaultConfig = getWidgetDefaultConfig('gantry');

type ThresholdKey =
  | 'slowSpeedThreshold'
  | 'slowFrameThreshold'
  | 'suddenStopFromSpeed'
  | 'suddenStopToSpeed'
  | 'suddenStopFrames'
  | 'offTrackDebounce'
  | 'pitEntryDebounce'
  | 'cooldownSeconds';

interface ThresholdField {
  key: ThresholdKey;
  label: string;
  description: string;
  /** Bounds are always expressed in km/h for speed fields. */
  min: number;
  max: number;
  isSpeed?: boolean;
}

const thresholdFields: ThresholdField[] = [
  {
    key: 'slowSpeedThreshold',
    label: 'Slow Speed Threshold',
    description:
      'A car travelling below this speed counts as crawling. Raise it to also pick up cars limping back to the pits; lower it so only near-stationary cars are reported and you get fewer false alarms in slow corners.',
    min: 1,
    max: 100,
    isSpeed: true,
  },
  {
    key: 'slowFrameThreshold',
    label: 'Slow Frame Count',
    description:
      'How many telemetry frames in a row (roughly 60 per second) a car must stay below the slow speed before it is logged. Raise it to ignore brief lifts and hairpins; lower it to react sooner.',
    min: 1,
    max: 60,
  },
  {
    key: 'suddenStopFromSpeed',
    label: 'Crash: Speed Before Impact',
    description:
      'How fast a car must have been going for a sudden deceleration to be treated as a crash. Raise it so only big-speed impacts register; lower it to also catch contact in slower corners.',
    min: 20,
    max: 300,
    isSpeed: true,
  },
  {
    key: 'suddenStopToSpeed',
    label: 'Crash: Speed After Impact',
    description:
      'The speed the car has to drop to for that deceleration to count as a crash. Raise it to flag heavy lock-ups and glancing hits; lower it so only cars brought to a near stop are reported.',
    min: 1,
    max: 50,
    isSpeed: true,
  },
  {
    key: 'suddenStopFrames',
    label: 'Crash: Frame Window',
    description:
      'How quickly the speed drop has to happen, in telemetry frames (roughly 60 per second). Lower it so only violent impacts qualify; raise it to also catch cars scrubbing speed through a long spin.',
    min: 1,
    max: 10,
  },
  {
    key: 'offTrackDebounce',
    label: 'Off-Track Debounce',
    description:
      'How many frames in a row a car must be off the racing surface before an off-track is logged. Raise it to ignore cars clipping a kerb or putting a wheel wide; lower it to catch every excursion.',
    min: 1,
    max: 10,
  },
  {
    key: 'pitEntryDebounce',
    label: 'Pit Entry Debounce',
    description:
      'How many frames in a row a car must be on pit road before a pit entry is logged. Raise it to avoid false entries from cars hugging the pit exit line; lower it to log entries sooner.',
    min: 1,
    max: 10,
  },
  {
    key: 'cooldownSeconds',
    label: 'Per-Type Cooldown',
    description:
      'How long to stay quiet before the same car can trigger the same kind of incident again. Raise it so one long spin does not fill the feed; lower it if you want every separate moment listed.',
    min: 1,
    max: 30,
  },
];

const retentionOptions = [
  { label: 'All', value: 'all' },
  { label: 'Last 5', value: '5' },
  { label: 'Last 10', value: '10' },
  { label: 'Last 20', value: '20' },
];

const toSessionRetention = (value: string): SessionRetention =>
  value === 'all' ? 'all' : (Number(value) as SessionRetention);

const thresholdKeys = thresholdFields.map((f) => f.key);

export const GantrySettings = memo(() => {
  const { currentDashboard } = useDashboard();
  const displayUnits = useTrackStateSelector(selectDisplayUnits); // 0 = imperial, 1 = metric
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as GantryWidgetSettings | undefined;
  const [settings, setSettings] = useState<GantryWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as GantryWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('gantryTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('gantryTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  const config = settings.config;
  const unitSetting = config.speedUnit ?? 'auto';
  const speedUnit = resolveSpeedUnit(unitSetting, displayUnits);
  // The track-state channel only publishes while the sim is connected, so Auto
  // falls back to the shared default until then.
  const autoUnresolved = unitSetting === 'auto' && displayUnits === undefined;

  return (
    <BaseSettingsSection
      title="Gantry"
      description="Race control window with live standings, an incident feed and a lap gap graph."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
      onConfigChange={(newConfig) => {
        const merged = { ...config, ...newConfig };

        if (thresholdKeys.some((key) => key in newConfig)) {
          window.raceControlBridge?.updateThresholds({
            slowSpeedThreshold: merged.slowSpeedThreshold,
            slowFrameThreshold: merged.slowFrameThreshold,
            suddenStopFromSpeed: merged.suddenStopFromSpeed,
            suddenStopToSpeed: merged.suddenStopToSpeed,
            suddenStopFrames: merged.suddenStopFrames,
            offTrackDebounce: merged.offTrackDebounce,
            pitEntryDebounce: merged.pitEntryDebounce,
            cooldownSeconds: merged.cooldownSeconds,
          });
        }

        if ('sessionRetention' in newConfig) {
          window.raceControlBridge?.updateRetention(merged.sessionRetention);
        }
      }}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="options"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Options
            </TabButton>
            <TabButton
              id="incidents"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Incidents
            </TabButton>
          </div>

          <div>
            {activeTab === 'options' && (
              <SettingsSection title="Options">
                <SettingActionButton
                  title="Gantry Window"
                  description="The Gantry runs in its own resizable window rather than as an on-screen overlay. Use this to bring it back if you closed it."
                  label="Show Window"
                  onClick={() => window.raceControlBridge?.showGantryWindow()}
                />

                <SettingDivider />

                <SettingButtonGroupRow<GantryConfig['speedUnit']>
                  title="Speed Units"
                  description={`Units for the speed settings on the Incidents tab. Values are always saved in km/h, so switching units never changes how incidents are detected.${
                    autoUnresolved
                      ? ` Auto follows iRacing's own unit setting, which is only known while the sim is running, so it shows ${speedUnit} for now.`
                      : ''
                  }`}
                  value={unitSetting}
                  options={[
                    { label: 'Auto', value: 'auto' },
                    { label: 'km/h', value: 'km/h' },
                    { label: 'mph', value: 'mph' },
                  ]}
                  onChange={(v) => handleConfigChange({ speedUnit: v })}
                />

                <SettingSelectRow
                  title="Keep Sessions"
                  description="How many past sessions the Gantry keeps in its history. Lower it if the incident feed gets long and you only care about the current race; All keeps everything until you clear it."
                  value={String(config.sessionRetention)}
                  options={retentionOptions}
                  onChange={(v) =>
                    handleConfigChange({
                      sessionRetention: toSessionRetention(v),
                    })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'incidents' && (
              <SettingsSection title="Incident Detection">
                {thresholdFields.map((field) => {
                  const suffix = field.isSpeed
                    ? ` (${speedUnit})`
                    : field.key === 'cooldownSeconds'
                      ? ' (seconds)'
                      : ' (frames)';

                  return (
                    <SettingNumberRow
                      key={field.key}
                      title={`${field.label}${suffix}`}
                      description={field.description}
                      value={
                        field.isSpeed
                          ? toDisplay(config[field.key], speedUnit)
                          : config[field.key]
                      }
                      min={
                        field.isSpeed
                          ? minToDisplay(field.min, speedUnit)
                          : field.min
                      }
                      max={
                        field.isSpeed
                          ? maxToDisplay(field.max, speedUnit)
                          : field.max
                      }
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({
                          [field.key]: field.isSpeed
                            ? fromDisplay(v, speedUnit)
                            : v,
                        } as Partial<GantryConfig>)
                      }
                    />
                  );
                })}
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
});
GantrySettings.displayName = 'GantrySettings';
