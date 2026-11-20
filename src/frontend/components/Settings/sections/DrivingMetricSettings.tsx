import type { ComponentType } from 'react';
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
  widgetId = id,
}: {
  id: K;
  widgetId?: string;
}) {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => widget.id === widgetId
  );
  const defaults = getWidgetDefaultConfig(id);
  const settings: BaseWidgetSettings<WidgetConfigMap[K]> = {
    enabled: saved?.enabled ?? false,
    config: (saved?.config as unknown as WidgetConfigMap[K]) ?? defaults,
  };

  return (
    <BaseSettingsSection
      title={titles[id] ?? id}
      description="Configure this driving telemetry widget."
      settings={settings}
      widgetId={widgetId}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {id === 'accelerationtimer' && (
            <SettingsSection title="Speed ranges">
              {(
                settings.config as WidgetConfigMap['accelerationtimer']
              ).ranges.map((range, index) => (
                <div className="grid grid-cols-2 gap-2" key={index}>
                  <SettingNumberRow
                    title={`Range ${index + 1} start`}
                    value={range.fromKph}
                    min={0}
                    max={400}
                    step={1}
                    onChange={(fromKph) => {
                      const ranges = [
                        ...(
                          settings.config as WidgetConfigMap['accelerationtimer']
                        ).ranges,
                      ];
                      ranges[index] = { ...ranges[index], fromKph };
                      handleConfigChange({ ranges } as unknown as Partial<
                        WidgetConfigMap[K]
                      >);
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
                        ...(
                          settings.config as WidgetConfigMap['accelerationtimer']
                        ).ranges,
                      ];
                      ranges[index] = { ...ranges[index], toKph };
                      handleConfigChange({ ranges } as unknown as Partial<
                        WidgetConfigMap[K]
                      >);
                    }}
                  />
                </div>
              ))}
            </SettingsSection>
          )}
          {id === 'stinthistory' && (
            <SettingsSection title="History">
              <SettingNumberRow
                title="Stints shown"
                value={
                  (settings.config as WidgetConfigMap['stinthistory']).maxStints
                }
                min={1}
                max={10}
                step={1}
                onChange={(maxStints) =>
                  handleConfigChange({ maxStints } as unknown as Partial<
                    WidgetConfigMap[K]
                  >)
                }
              />
            </SettingsSection>
          )}
          {id === 'tyrepanel' && (
            <>
              <SettingsSection title="Units">
                <SettingToggleRow
                  title="Use Fahrenheit"
                  enabled={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .temperatureUnit === 'F'
                  }
                  onToggle={(enabled) =>
                    handleConfigChange({
                      temperatureUnit: enabled ? 'F' : 'C',
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
                <SettingToggleRow
                  title="Use PSI"
                  enabled={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .pressureUnit === 'psi'
                  }
                  onToggle={(enabled) =>
                    handleConfigChange({
                      pressureUnit: enabled ? 'psi' : 'kPa',
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
              </SettingsSection>
              <SettingsSection title="Temperature bands">
                <SettingNumberRow
                  title="Cold below"
                  description="Temperature in °C. Display-unit changes do not alter thresholds."
                  value={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .temperatureThresholds?.cold ?? 70
                  }
                  min={0}
                  max={
                    ((settings.config as WidgetConfigMap['tyrepanel'])
                      .temperatureThresholds?.hot ?? 100) - 1
                  }
                  step={1}
                  onChange={(cold) =>
                    handleConfigChange({
                      temperatureThresholds: {
                        cold,
                        hot:
                          (settings.config as WidgetConfigMap['tyrepanel'])
                            .temperatureThresholds?.hot ?? 100,
                      },
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
                <SettingNumberRow
                  title="Hot above"
                  value={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .temperatureThresholds?.hot ?? 100
                  }
                  min={
                    ((settings.config as WidgetConfigMap['tyrepanel'])
                      .temperatureThresholds?.cold ?? 70) + 1
                  }
                  max={200}
                  step={1}
                  onChange={(hot) =>
                    handleConfigChange({
                      temperatureThresholds: {
                        cold:
                          (settings.config as WidgetConfigMap['tyrepanel'])
                            .temperatureThresholds?.cold ?? 70,
                        hot,
                      },
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
              </SettingsSection>
              <SettingsSection title="Tread bands">
                <SettingNumberRow
                  title="Worn at or below"
                  description="Remaining tread percentage."
                  value={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .wearThresholds?.worn ?? 60
                  }
                  min={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .wearThresholds?.replace ?? 30
                  }
                  max={100}
                  step={1}
                  onChange={(worn) =>
                    handleConfigChange({
                      wearThresholds: {
                        worn,
                        replace:
                          (settings.config as WidgetConfigMap['tyrepanel'])
                            .wearThresholds?.replace ?? 30,
                      },
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
                <SettingNumberRow
                  title="Replace at or below"
                  value={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .wearThresholds?.replace ?? 30
                  }
                  min={0}
                  max={
                    (settings.config as WidgetConfigMap['tyrepanel'])
                      .wearThresholds?.worn ?? 60
                  }
                  step={1}
                  onChange={(replace) =>
                    handleConfigChange({
                      wearThresholds: {
                        worn:
                          (settings.config as WidgetConfigMap['tyrepanel'])
                            .wearThresholds?.worn ?? 60,
                        replace,
                      },
                    } as unknown as Partial<WidgetConfigMap[K]>)
                  }
                />
              </SettingsSection>
            </>
          )}
          {id === 'cruiseodometer' && (
            <SettingsSection title="Units">
              <SettingToggleRow
                title="Use miles"
                enabled={
                  (settings.config as WidgetConfigMap['cruiseodometer'])
                    .distanceUnit === 'mi'
                }
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
                handleConfigChange({
                  background: { opacity },
                } as unknown as Partial<WidgetConfigMap[K]>)
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
                handleConfigChange({
                  showOnlyWhenOnTrack,
                } as unknown as Partial<WidgetConfigMap[K]>)
              }
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
}

const drivingMetricPage = (
  id: DrivingMetricId
): ComponentType<{ widgetId?: string; widgetType?: string }> =>
  function DrivingMetricSettingsPage({ widgetId }) {
    return <DrivingMetricSettings id={id} widgetId={widgetId} />;
  };

export const drivingMetricSettingsPages = {
  accelerationtimer: drivingMetricPage('accelerationtimer'),
  stinthistory: drivingMetricPage('stinthistory'),
  frictioncircle: drivingMetricPage('frictioncircle'),
  tyrepanel: drivingMetricPage('tyrepanel'),
  brakepressure: drivingMetricPage('brakepressure'),
  suspensionposition: drivingMetricPage('suspensionposition'),
  trackclock: drivingMetricPage('trackclock'),
  steeringmeter: drivingMetricPage('steeringmeter'),
  cruiseodometer: drivingMetricPage('cruiseodometer'),
};
