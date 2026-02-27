import { useState } from 'react';
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

const defaultConfig: TelemetryInspectorConfig = {
  background: { opacity: 80 },
  properties: [
    { source: 'telemetry', path: 'Speed', label: 'Speed' },
    { source: 'telemetry', path: 'SessionTime', label: 'Session Time' },
  ],
};

const migrateConfig = (savedConfig: unknown): TelemetryInspectorConfig => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ??
        defaultConfig.background?.opacity ??
        80,
    },
    properties: (config.properties as PropertyConfig[]) ?? defaultConfig.properties,
  };
};

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
];

export const TelemetryInspectorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TelemetryInspectorWidgetSettings | undefined;
  const [settings, setSettings] = useState<TelemetryInspectorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
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
      title="Telemetry Inspector"
      description="Debug widget to display raw telemetry and session values. Add properties to watch."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const properties = settings.config.properties ?? [];

        const addProperty = (prop: PropertyConfig) => {
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
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-slate-200">
                Watched Properties ({properties.length})
              </h3>
              {properties.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No properties configured. Add some below.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {properties.map((prop, index) => (
                    <div
                      key={`${prop.source}-${prop.path}-${index}`}
                      className="flex items-center justify-between bg-slate-700 rounded px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            prop.source === 'telemetry'
                              ? 'bg-blue-600 text-blue-100'
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
                        className="p-1 hover:bg-slate-600 rounded transition-colors"
                      >
                        <TrashIcon size={16} className="text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Custom Property */}
            <div className="space-y-2 border-t border-slate-600 pt-4">
              <h3 className="text-lg font-medium text-slate-200">
                Add Custom Property
              </h3>
              <div className="flex gap-2">
                <select
                  value={newProperty.source}
                  onChange={(e) =>
                    setNewProperty({
                      ...newProperty,
                      source: e.target.value as 'telemetry' | 'session',
                    })
                  }
                  className="bg-slate-700 text-slate-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="telemetry">Telemetry</option>
                  <option value="session">Session</option>
                </select>
                <input
                  type="text"
                  placeholder="Property path (e.g., Speed)"
                  value={newProperty.path}
                  onChange={(e) =>
                    setNewProperty({ ...newProperty, path: e.target.value })
                  }
                  className="flex-1 bg-slate-700 text-slate-300 rounded px-3 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={newProperty.label ?? ''}
                  onChange={(e) =>
                    setNewProperty({ ...newProperty, label: e.target.value })
                  }
                  className="w-32 bg-slate-700 text-slate-300 rounded px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => {
                    if (newProperty.path) {
                      addProperty(newProperty);
                    }
                  }}
                  disabled={!newProperty.path}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </div>

            {/* Quick Add Common Properties */}
            <div className="space-y-2 border-t border-slate-600 pt-4">
              <h3 className="text-lg font-medium text-slate-200">
                Quick Add - Telemetry
              </h3>
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
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                  >
                    {prop.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium text-slate-200">
                Quick Add - Session
              </h3>
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
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                  >
                    {prop.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Opacity */}
            <div className="flex items-center justify-between border-t border-slate-600 pt-4">
              <span className="text-sm text-slate-300">Background Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.config.background?.opacity ?? 80}
                  onChange={(e) =>
                    handleConfigChange({
                      background: { opacity: parseInt(e.target.value) },
                    })
                  }
                  className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
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
