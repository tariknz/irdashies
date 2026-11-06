import { SettingsSection } from '../components/SettingSection';
import { useState } from 'react';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { TrashIcon, PlusIcon } from '@phosphor-icons/react';

const SETTING_ID = 'telemetryinspector';

interface PropertyConfig {
  source: 'telemetry' | 'session';
  path: string;
  label?: string;
}

interface TelemetryInspectorConfig {
  background?: { opacity: number };
  properties?: PropertyConfig[];
}

interface TelemetryInspectorWidgetSettings {
  enabled: boolean;
  config: TelemetryInspectorConfig;
}

const defaultConfig = getWidgetDefaultConfig('telemetryinspector');

// Common telemetry properties for quick add
const commonTelemetryProperties = [
  { path: 'Speed', label: 'Speed' },
  { path: 'RPM', label: 'RPM' },
  { path: 'Gear', label: 'Gear' },
  { path: 'Throttle', label: 'Throttle' },
  { path: 'Brake', label: 'Brake' },
  { path: 'Clutch', label: 'Clutch' },
  { path: 'SteeringWheelAngle', label: 'Steering Angle' },
  { path: 'Lap', label: 'Lap' },
  { path: 'LapDist', label: 'Lap Distance' },
  { path: 'LapDistPct', label: 'Lap Distance %' },
  { path: 'SessionTime', label: 'Session Time' },
  { path: 'SessionTimeRemain', label: 'Time Remaining' },
  { path: 'FuelLevel', label: 'Fuel Level' },
  { path: 'FuelLevelPct', label: 'Fuel Level %' },
  { path: 'FuelUsePerHour', label: 'Fuel Use/Hour' },
  { path: 'IsOnTrack', label: 'Is On Track' },
  { path: 'CarIdxLapDistPct', label: 'Car Lap Dist %' },
  { path: 'CarIdxOnPitRoad', label: 'Car On Pit Road' },
  { path: 'CarIdxPosition', label: 'Car Position' },
  { path: 'PlayerCarPosition', label: 'Player Position' },
  { path: 'PlayerCarClassPosition', label: 'Player Class Position' },
  { path: 'AirTemp', label: 'Air Temperature' },
  { path: 'TrackTemp', label: 'Track Temperature' },
  { path: 'TrackTempCrew', label: 'Track Temp (Crew)' },
  // LMU only. Absent under iRacing, where they read N/A.
  { path: 'LmuPitStopTime', label: 'LMU Pit Stop Time' },
  { path: 'LmuRepairTime', label: 'LMU Repair Time' },
  { path: 'LmuRefuelTarget', label: 'LMU Refuel Target' },
  {
    path: 'LmuRefuelTargetIsVirtualEnergy',
    label: 'LMU Refuel Is Virtual Energy',
  },
  { path: 'LmuVirtualEnergy', label: 'LMU Virtual Energy' },
  { path: 'LmuStateOfCharge', label: 'LMU State Of Charge' },
  { path: 'LmuRegen', label: 'LMU Regen' },
  { path: 'LmuBrakeWear', label: 'LMU Brake Wear' },
  { path: 'LmuSuspensionDamage', label: 'LMU Suspension Damage' },
  { path: 'LmuAeroDamage', label: 'LMU Aero Damage' },
];

// Common session properties for quick add
const commonSessionProperties = [
  { path: 'WeekendInfo.TrackName', label: 'Track Name' },
  { path: 'WeekendInfo.TrackLength', label: 'Track Length' },
  { path: 'WeekendInfo.TeamRacing', label: 'Team Racing' },
  { path: 'WeekendInfo.NumCarClasses', label: 'Num Car Classes' },
  { path: 'WeekendInfo.EventType', label: 'Event Type' },
  { path: 'DriverInfo.DriverCarIdx', label: 'Driver Car Index' },
  { path: 'DriverInfo.DriverPitTrkPct', label: 'Pit Track %' },
  // LMU only, from its REST API.
  { path: 'DriverInfo.DriverCarFuelMaxLtr', label: 'Fuel Capacity (L)' },
  { path: 'LmuRest.timeScale', label: 'LMU Time Scale' },
  { path: 'LmuRest.maxVirtualEnergy', label: 'LMU Max Virtual Energy' },
  { path: 'LmuRest.privateQualifying', label: 'LMU Private Qualifying' },
  { path: 'LmuRest.fuelRatio', label: 'LMU Fuel Ratio (L per % VE)' },
  { path: 'LmuRest.fuelLevelMax', label: 'LMU Fuel Slider Max (L)' },
];

export const TelemetryInspectorSettings = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const GroupHeading = embedded ? 'h4' : 'h3';
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TelemetryInspectorWidgetSettings | undefined;
  const [settings, setSettings] = useState<TelemetryInspectorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as TelemetryInspectorConfig) ?? defaultConfig,
  });

  const [newProperty, setNewProperty] = useState<PropertyConfig>({
    source: 'telemetry',
    path: '',
    label: '',
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      headingLevel={embedded ? 'h3' : 'h2'}
      disableInternalScroll={embedded}
      title="Telemetry Inspector"
      description="Debug widget to display raw telemetry and session values. Add properties to watch."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const properties = settings.config.properties ?? [];

        const addProperty = (prop: PropertyConfig) => {
          const alreadyExists = properties.some(
            (existing) =>
              existing.source === prop.source && existing.path === prop.path
          );
          if (alreadyExists) return;

          const newProperties = [...properties, prop];
          handleConfigChange({ properties: newProperties });
          setNewProperty({ source: 'telemetry', path: '', label: '' });
        };

        const removeProperty = (index: number) => {
          const newProperties = properties.filter((_, i) => i !== index);
          handleConfigChange({ properties: newProperties });
        };

        return (
          <div className="space-y-4">
            {/* Current Properties */}
            <SettingsSection
              title={`Watched Properties (${properties.length})`}
              headingLevel={GroupHeading}
              scaleWidgetId={SETTING_ID}
            >
              {properties.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No properties configured. Add some below.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {properties.map((prop, index) => (
                    <div
                      key={`${prop.source}-${prop.path}-${index}`}
                      className="flex items-center justify-between gap-2 border-b border-slate-700 py-1.5"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            prop.source === 'telemetry'
                              ? 'bg-accent-600 text-on-accent'
                              : 'bg-green-600 text-green-100'
                          }`}
                        >
                          {prop.source === 'telemetry' ? 'T' : 'S'}
                        </span>
                        <span className="text-sm text-slate-300">
                          {prop.label || prop.path}
                        </span>
                        {prop.label && (
                          <span className="text-xs text-slate-500">
                            ({prop.path})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeProperty(index)}
                        type="button"
                        aria-label={`Remove ${prop.label || prop.path}`}
                        className="settings-button h-9 w-9 shrink-0 p-0"
                      >
                        <TrashIcon size={16} className="text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>

            {/* Add Custom Property */}
            <div className="space-y-2 border-t border-settings-boundary pt-4">
              <GroupHeading className="text-sm font-semibold text-slate-200">
                Add Custom Property
              </GroupHeading>
              <div className="grid grid-cols-2 items-end gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                  Source
                  <select
                    value={newProperty.source}
                    onChange={(e) =>
                      setNewProperty({
                        ...newProperty,
                        source: e.target.value as 'telemetry' | 'session',
                      })
                    }
                    className="settings-field"
                  >
                    <option value="telemetry">Telemetry</option>
                    <option value="session">Session</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                  Property path
                  <input
                    type="text"
                    placeholder="Property path (e.g., Speed)"
                    value={newProperty.path}
                    onChange={(e) =>
                      setNewProperty({ ...newProperty, path: e.target.value })
                    }
                    className="settings-field w-full"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                  Label (optional)
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={newProperty.label ?? ''}
                    onChange={(e) =>
                      setNewProperty({ ...newProperty, label: e.target.value })
                    }
                    className="settings-field w-full"
                  />
                </label>
                <button
                  onClick={() => {
                    if (newProperty.path) {
                      addProperty(newProperty);
                    }
                  }}
                  disabled={!newProperty.path}
                  type="button"
                  className="settings-button-primary"
                >
                  <PlusIcon size={16} /> Add property
                </button>
              </div>
            </div>

            {/* Quick Add Common Properties */}
            <div className="space-y-2 border-t border-settings-boundary pt-4">
              <GroupHeading className="text-sm font-semibold text-slate-200">
                Quick Add - Telemetry
              </GroupHeading>
              <div className="flex flex-wrap gap-1">
                {commonTelemetryProperties.map((prop) => (
                  <button
                    key={prop.path}
                    onClick={() =>
                      addProperty({
                        source: 'telemetry',
                        path: prop.path,
                        label: prop.label,
                      })
                    }
                    disabled={properties.some(
                      (existing) =>
                        existing.source === 'telemetry' &&
                        existing.path === prop.path
                    )}
                    className="settings-button"
                  >
                    {prop.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <GroupHeading className="text-sm font-semibold text-slate-200">
                Quick Add - Session
              </GroupHeading>
              <div className="flex flex-wrap gap-1">
                {commonSessionProperties.map((prop) => (
                  <button
                    key={prop.path}
                    onClick={() =>
                      addProperty({
                        source: 'session',
                        path: prop.path,
                        label: prop.label,
                      })
                    }
                    disabled={properties.some(
                      (existing) =>
                        existing.source === 'session' &&
                        existing.path === prop.path
                    )}
                    className="settings-button"
                  >
                    {prop.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Opacity */}
            <div className="flex items-center justify-between border-t border-settings-boundary pt-4">
              <span className="text-sm text-slate-300">Background Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Background Opacity"
                  min="0"
                  max="100"
                  value={settings.config.background?.opacity ?? 80}
                  onChange={(e) =>
                    handleConfigChange({
                      background: { opacity: parseInt(e.target.value) },
                    })
                  }
                  className="w-20 h-2 bg-settings-track rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-slate-400 w-8">
                  {settings.config.background?.opacity ?? 80}%
                </span>
              </div>
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
