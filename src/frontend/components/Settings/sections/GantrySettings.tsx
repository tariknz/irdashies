import { memo, useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  GantryWidgetSettings,
  GantryConfig,
  LapGraphYAxisMode,
  SessionRetention,
  SettingsTabType,
  INCIDENT_THRESHOLD_BOUNDS,
  LAP_GRAPH_LAP_WINDOW_BOUNDS,
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
import { SettingToggleRow } from '../components/SettingToggleRow';
import { DriverNamePreview } from '../components/DriverNamePreview';
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
  | 'slowDurationSeconds'
  | 'impactDecelKmhPerSec'
  | 'impactMinSpeed'
  | 'offTrackDurationSeconds'
  | 'pitEntryDurationSeconds'
  | 'cooldownSeconds';

interface ThresholdField {
  key: ThresholdKey;
  label: string;
  description: string;
  /** Bounds are always expressed in km/h for speed fields. */
  min: number;
  max: number;
  isSpeed?: boolean;
  isSeconds?: boolean;
  /**
   * A deceleration. Stored in km/h per second and converted to the selected
   * display unit per second, the same way speed fields are.
   */
  isRate?: boolean;
}

const thresholdFields: ThresholdField[] = [
  {
    key: 'slowSpeedThreshold',
    label: 'Slow Speed Threshold',
    description:
      'A car travelling below this speed counts as crawling. Raise it to also pick up cars limping back to the pits; lower it so only near-stationary cars are reported and you get fewer false alarms in slow corners.',
    ...INCIDENT_THRESHOLD_BOUNDS.slowSpeedThreshold,
    isSpeed: true,
  },
  {
    key: 'slowDurationSeconds',
    label: 'Slow For',
    description:
      'How long a car must stay below the slow speed before it is logged. Raise it to ignore brief lifts and hairpins; lower it to react sooner.',
    ...INCIDENT_THRESHOLD_BOUNDS.slowDurationSeconds,
    isSeconds: true,
  },
  {
    key: 'impactDecelKmhPerSec',
    label: 'Crash: Impact Severity',
    description:
      'How much speed a car must shed each second for it to count as a crash. This is what separates a crash from braking: the hardest braking a road car manages is about 1.3g and a high-downforce car about 2.5g, while hitting a wall starts near 7g. The default sits at roughly 4g. Lower it to catch lighter contact; raise it if hard braking is being reported.',
    ...INCIDENT_THRESHOLD_BOUNDS.impactDecelKmhPerSec,
    isRate: true,
  },
  {
    key: 'impactMinSpeed',
    label: 'Crash: Minimum Speed',
    description:
      'How fast a car must have been going for an impact to be worth reporting. Keeps pit-lane bumps and low-speed nudges out of the feed.',
    ...INCIDENT_THRESHOLD_BOUNDS.impactMinSpeed,
    isSpeed: true,
  },
  {
    key: 'offTrackDurationSeconds',
    label: 'Off-Track For',
    description:
      'How long a car must be off the racing surface before an off-track is logged. Raise it to ignore cars clipping a kerb or putting a wheel wide; lower it to catch every excursion.',
    ...INCIDENT_THRESHOLD_BOUNDS.offTrackDurationSeconds,
    isSeconds: true,
  },
  {
    key: 'pitEntryDurationSeconds',
    label: 'Pit Entry After',
    description:
      'How long a car must be on pit road before a pit entry is logged. Raise it to avoid false entries from cars hugging the pit exit line; lower it to log entries sooner.',
    ...INCIDENT_THRESHOLD_BOUNDS.pitEntryDurationSeconds,
    isSeconds: true,
  },
  {
    key: 'cooldownSeconds',
    label: 'Per-Type Cooldown',
    description:
      'How long to stay quiet before the same car can trigger the same kind of incident again. Raise it so one long spin does not fill the feed; lower it if you want every separate moment listed.',
    ...INCIDENT_THRESHOLD_BOUNDS.cooldownSeconds,
  },
];

const NAME_FORMATS = [
  'name-middlename-surname',
  'name-m.-surname',
  'name-surname',
  'n.-surname',
  'surname-n.',
  'surname',
] as const;

const retentionOptions = [
  { label: 'All', value: 'all' },
  { label: 'Last 5', value: '5' },
  { label: 'Last 10', value: '10' },
  { label: 'Last 20', value: '20' },
];

const toSessionRetention = (value: string): SessionRetention =>
  value === 'all' ? 'all' : (Number(value) as SessionRetention);

interface YAxisModeOption {
  value: LapGraphYAxisMode;
  label: string;
  description: string;
}

const Y_AXIS_MODES: YAxisModeOption[] = [
  {
    value: 'trace',
    label: 'Race Trace',
    description:
      "How far ahead of or behind a reference pace each car is, lap by lap. A flat line means lapping exactly at the reference pace, and higher is better. The reference pace is the class leader's median lap.",
  },
  {
    value: 'position',
    label: 'Position',
    description:
      'Where each car ran in its class at the end of every lap. A line moving up is a place gained.',
  },
  {
    value: 'gap',
    label: 'Gap to Leader',
    description:
      'How many seconds behind the class leader each car was at the end of every lap. The leader sits on zero.',
  },
];

const yAxisModeButtons = Y_AXIS_MODES.map(({ value, label }) => ({
  value,
  label,
}));

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

  // `useState` only reads its initialiser on the first render. If this mounts
  // before the dashboard has loaded — or the user switches profile — the local
  // copy keeps the defaults, so the fields below show defaults and the next
  // edit writes them back over the persisted config. Re-seed whenever the
  // saved widget changes, using the same guarded set-during-render sync as
  // BaseSettingsSection so there is no stale first paint.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        enabled: savedSettings.enabled ?? true,
        config:
          (savedSettings.config as GantryWidgetSettings['config']) ??
          defaultConfig,
      });
    }
  }

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('gantryTab') as SettingsTabType) || 'options'
  );
  const [showDisabledHint, setShowDisabledHint] = useState(false);

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
  // A config saved before the lap graph settings existed has no block until the
  // migrator runs on the next dashboard load.
  const lapGraph = config.lapGraph ?? defaultConfig.lapGraph;

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
            slowDurationSeconds: merged.slowDurationSeconds,
            impactDecelKmhPerSec: merged.impactDecelKmhPerSec,
            impactMinSpeed: merged.impactMinSpeed,
            offTrackDurationSeconds: merged.offTrackDurationSeconds,
            pitEntryDurationSeconds: merged.pitEntryDurationSeconds,
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
                  description={`The Gantry runs in its own resizable window rather than as an on-screen overlay. Use this to bring it back if you closed it.${
                    showDisabledHint
                      ? ' Turn the Gantry on above to open its window.'
                      : ''
                  }`}
                  label="Show Window"
                  onClick={() =>
                    void window.raceControlBridge
                      ?.showGantryWindow()
                      .then((opened) => setShowDisabledHint(!opened))
                  }
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

                <SettingDivider />

                <div className="py-2">
                  <div className="text-sm text-slate-300">Driver Name</div>
                  <div className="text-xs text-slate-400 mt-1">
                    How names are written in the Gantry standings list. Surname
                    only keeps the column narrow, which is what the panel is
                    sized for.
                  </div>
                  <div className="flex flex-wrap gap-3 justify-end mt-3">
                    {NAME_FORMATS.map((format) => (
                      <DriverNamePreview
                        key={format}
                        format={format}
                        selected={
                          (config.driverNameFormat ?? 'surname') === format
                        }
                        onClick={() =>
                          handleConfigChange({ driverNameFormat: format })
                        }
                      />
                    ))}
                  </div>
                </div>

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

            {activeTab === 'options' && (
              <SettingsSection title="Lap Graph">
                <SettingButtonGroupRow<LapGraphYAxisMode>
                  title="Default Y Axis"
                  description="What the Lap Graph tab measures when the Gantry opens. You can still switch axis on the tab itself."
                  value={lapGraph.yAxisMode}
                  options={yAxisModeButtons}
                  onChange={(v) =>
                    handleConfigChange({
                      lapGraph: { ...lapGraph, yAxisMode: v },
                    })
                  }
                />

                <dl className="space-y-2 text-xs">
                  {Y_AXIS_MODES.map((mode) => {
                    const isActive = mode.value === lapGraph.yAxisMode;
                    return (
                      <div key={mode.value} className="flex gap-3">
                        <dt
                          className={`w-28 shrink-0 ${
                            isActive ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {mode.label}
                        </dt>
                        <dd
                          className={
                            isActive ? 'text-slate-400' : 'text-slate-500'
                          }
                        >
                          {mode.description}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                <SettingDivider />

                <SettingNumberRow
                  title="Laps Shown"
                  description={`How many laps fit on the graph at once. It follows the latest lap, so earlier laps scroll off the left; you can still pan back to them. ${LAP_GRAPH_LAP_WINDOW_BOUNDS.min} to ${LAP_GRAPH_LAP_WINDOW_BOUNDS.max} laps.`}
                  value={lapGraph.lapWindow}
                  min={LAP_GRAPH_LAP_WINDOW_BOUNDS.min}
                  max={LAP_GRAPH_LAP_WINDOW_BOUNDS.max}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({
                      lapGraph: { ...lapGraph, lapWindow: v },
                    })
                  }
                />

                <SettingDivider />

                <SettingToggleRow
                  title="Pin Cars Automatically"
                  description="Start with your car, the class leader and the cars around you already drawn. Turn it off to open an empty graph and pick the cars yourself."
                  enabled={lapGraph.autoPin}
                  onToggle={(v) =>
                    handleConfigChange({
                      lapGraph: { ...lapGraph, autoPin: v },
                    })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'incidents' && (
              <SettingsSection title="Incident Detection">
                {thresholdFields.map((field) => {
                  const isSeconds =
                    field.isSeconds || field.key === 'cooldownSeconds';
                  // A deceleration rate scales with the speed unit, so it is
                  // converted like a speed and labelled per second.
                  const converts = field.isSpeed || field.isRate;
                  const suffix = field.isRate
                    ? ` (${speedUnit} per second)`
                    : field.isSpeed
                      ? ` (${speedUnit})`
                      : isSeconds
                        ? ' (seconds)'
                        : '';

                  return (
                    <SettingNumberRow
                      key={field.key}
                      title={`${field.label}${suffix}`}
                      description={field.description}
                      value={
                        converts
                          ? toDisplay(config[field.key], speedUnit)
                          : config[field.key]
                      }
                      min={
                        converts
                          ? minToDisplay(field.min, speedUnit)
                          : field.min
                      }
                      max={
                        converts
                          ? maxToDisplay(field.max, speedUnit)
                          : field.max
                      }
                      step={isSeconds ? 0.1 : field.isRate ? 10 : 1}
                      onChange={(v) =>
                        handleConfigChange({
                          [field.key]: converts ? fromDisplay(v, speedUnit) : v,
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
