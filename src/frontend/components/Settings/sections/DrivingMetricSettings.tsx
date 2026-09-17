import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type BaseWidgetSettings,
  type WidgetConfigMap,
} from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';

const titles: Record<string, string> = {
  tracknotes: 'Track Notes',
  accelerationtimer: 'Acceleration Timer',
  stinthistory: 'Stint History',
  frictioncircle: 'Friction Circle',
  tyrepanel: 'Tyre Panel',
  brakepressure: 'Brake Pressure',
  suspensionposition: 'Suspension Position',
  trackclock: 'Track Clock',
  steeringmeter: 'Steering Meter',
  cruiseodometer: 'Cruise / Odometer',
};

type DrivingMetricId =
  | 'tracknotes'
  | 'accelerationtimer'
  | 'stinthistory'
  | 'frictioncircle'
  | 'tyrepanel'
  | 'brakepressure'
  | 'suspensionposition'
  | 'trackclock'
  | 'steeringmeter'
  | 'cruiseodometer';

export function DrivingMetricSettings<K extends DrivingMetricId>({
  id,
}: {
  id: K;
}) {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === id
  );
  const defaults = getWidgetDefaultConfig(id);
  const [settings, setSettings] = useState<BaseWidgetSettings<WidgetConfigMap[K]>>({
    enabled: saved?.enabled ?? false,
    config: (saved?.config as unknown as WidgetConfigMap[K]) ?? defaults,
  });

  return (
    <BaseSettingsSection
      title={titles[id] ?? id}
      description="Configure this driving telemetry widget."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={String(id)}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {id === 'accelerationtimer' && (
            <SettingsSection title="Speed ranges">
              {(settings.config as WidgetConfigMap['accelerationtimer']).ranges.map(
                (range, index) => (
                  <div className="grid grid-cols-2 gap-2" key={index}>
                    <SettingNumberRow
                      title={`Range ${index + 1} start`}
                      value={range.fromKph}
                      min={0}
                      max={400}
                      step={1}
                      onChange={(fromKph) => {
                        const ranges = [
                          ...(settings.config as WidgetConfigMap['accelerationtimer']).ranges,
                        ];
                        ranges[index] = { ...ranges[index], fromKph };
                        handleConfigChange({ ranges } as unknown as Partial<WidgetConfigMap[K]>);
                      }}
                    />
                    <SettingNumberRow
                      title={`Range ${index + 1} end`}
                      value={range.toKph}
                      min={1}
                      max={500}
                      step={1}
                      onChange={(toKph) => {
                        const ranges = [
                          ...(settings.config as WidgetConfigMap['accelerationtimer']).ranges,
                        ];
                        ranges[index] = { ...ranges[index], toKph };
                        handleConfigChange({ ranges } as unknown as Partial<WidgetConfigMap[K]>);
                      }}
                    />
                  </div>
                )
              )}
            </SettingsSection>
          )}
          {id === 'tracknotes' && (
            <SettingsSection title="Notes">
              <SettingNumberRow
                title="Trigger tolerance"
                description="Distance around each note as a percentage of the lap."
                value={(settings.config as WidgetConfigMap['tracknotes']).triggerDistancePct * 100}
                min={0.05}
                max={5}
                step={0.05}
                onChange={(value) =>
                  handleConfigChange({
                    triggerDistancePct: value / 100,
                  } as unknown as Partial<WidgetConfigMap[K]>)
                }
              />
              <textarea
                className="min-h-36 w-full rounded bg-slate-800 p-2 font-mono text-sm"
                aria-label="Track notes"
                value={(settings.config as WidgetConfigMap['tracknotes']).notes
                  .map((note) => `${note.trackId}|${(note.lapDistPct * 100).toFixed(2)}|${note.scope}|${note.text}`)
                  .join('\n')}
                onChange={(event) => {
                  const notes: WidgetConfigMap['tracknotes']['notes'] = event.target.value
                    .split('\n')
                    .map<WidgetConfigMap['tracknotes']['notes'][number]>((line, index) => {
                      const [trackId = '', pct = '', scope = 'always', ...text] =
                        line.split('|');
                      return {
                        id: `${trackId}-${index}`,
                        trackId,
                        lapDistPct: Number(pct) / 100,
                        scope:
                          scope === 'pit' || scope === 'session'
                            ? (scope as 'pit' | 'session')
                            : 'always',
                        text: text.join('|'),
                      };
                    })
                    .filter(
                      (note) =>
                        Number.isFinite(note.lapDistPct) &&
                        note.lapDistPct >= 0 &&
                        note.lapDistPct <= 1 &&
                        note.text.length > 0
                    );
                  handleConfigChange({ notes } as unknown as Partial<WidgetConfigMap[K]>);
                  void window.trackNotesBridge?.saveNotes(notes);
                }}
              />
              <div className="text-xs text-slate-400">
                One per line: TrackID|lap %|always/pit/session|note
              </div>
            </SettingsSection>
          )}
          {id === 'stinthistory' && (
            <SettingsSection title="History">
              <SettingNumberRow
                title="Stints shown"
                value={(settings.config as WidgetConfigMap['stinthistory']).maxStints}
                min={1}
                max={10}
                step={1}
                onChange={(maxStints) =>
                  handleConfigChange({ maxStints } as unknown as Partial<WidgetConfigMap[K]>)
                }
              />
            </SettingsSection>
          )}
          {id === 'tyrepanel' && (
            <SettingsSection title="Units">
              <SettingToggleRow
                title="Use Fahrenheit"
                enabled={(settings.config as WidgetConfigMap['tyrepanel']).temperatureUnit === 'F'}
                onToggle={(enabled) =>
                  handleConfigChange({
                    temperatureUnit: enabled ? 'F' : 'C',
                  } as unknown as Partial<WidgetConfigMap[K]>)
                }
              />
              <SettingToggleRow
                title="Use PSI"
                enabled={(settings.config as WidgetConfigMap['tyrepanel']).pressureUnit === 'psi'}
                onToggle={(enabled) =>
                  handleConfigChange({
                    pressureUnit: enabled ? 'psi' : 'kPa',
                  } as unknown as Partial<WidgetConfigMap[K]>)
                }
              />
            </SettingsSection>
          )}
          {id === 'cruiseodometer' && (
            <SettingsSection title="Units">
              <SettingToggleRow
                title="Use miles"
                enabled={(settings.config as WidgetConfigMap['cruiseodometer']).distanceUnit === 'mi'}
                onToggle={(enabled) =>
                  handleConfigChange({
                    distanceUnit: enabled ? 'mi' : 'km',
                  } as unknown as Partial<WidgetConfigMap[K]>)
                }
              />
            </SettingsSection>
          )}
          <SettingsSection title="Display">
            <SettingSliderRow
              title="Background opacity"
              value={settings.config.background.opacity}
              units="%"
              min={0}
              max={100}
              step={5}
              onChange={(opacity) =>
                handleConfigChange({ background: { opacity } } as unknown as Partial<WidgetConfigMap[K]>)
              }
            />
          </SettingsSection>
          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={
                handleConfigChange as unknown as (
                  config: Record<string, unknown>
                ) => void
              }
            />
            <SettingToggleRow
              title="Show only when on track"
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(showOnlyWhenOnTrack) =>
                handleConfigChange({ showOnlyWhenOnTrack } as unknown as Partial<WidgetConfigMap[K]>)
              }
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
}
