/** Baseline field checks, not proof of changing values or complete behavior. */
const REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  input: ['Throttle', 'Brake', 'SteeringWheelAngle'],
  radar: ['CarIdxLapDistPct', 'CarIdxTrackSurface', 'PlayerCarIdx'],
  map: ['CarIdxLapDistPct', 'CarIdxPosition'],
  flatmap: ['CarIdxLapDistPct', 'CarIdxPosition'],
  standings: ['CarIdxPosition', 'CarIdxClassPosition', 'CarIdxLapDistPct'],
  relative: ['CarIdxLapDistPct', 'CarIdxEstTime', 'PlayerCarIdx'],
  fuel: ['FuelLevel', 'SessionTime', 'Lap'],
  wind: ['WindDir', 'WindVel', 'YawNorth'],
  weather: ['AirTemp', 'TrackTempCrew', 'WindVel'],
  tachometer: ['RPM', 'Gear', 'Speed'],
  shiftlight: ['RPM', 'Gear'],
  laptrace: ['LapDistPct', 'SessionTime', 'Throttle', 'Brake'],
};

export interface ReplayWidgetCoverage {
  widget: string;
  status: 'fields-present' | 'missing-fields' | 'unknown';
  missing: string[];
}

export function replayWidgetCoverage(
  variables: readonly string[],
  widgets: readonly string[]
): ReplayWidgetCoverage[] {
  const present = new Set(variables);
  return [...new Set(widgets)].map((widget) => {
    const required = REQUIRED_FIELDS[widget];
    const missing = required?.filter((field) => !present.has(field)) ?? [];
    return {
      widget,
      status: !required
        ? 'unknown'
        : missing.length
          ? 'missing-fields'
          : 'fields-present',
      missing,
    };
  });
}
