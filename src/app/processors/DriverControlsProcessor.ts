import type {
  DriverControlsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const rawValue = (frame: Telemetry, key: string): unknown =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value?.[0];

const numberValue = (frame: Telemetry, key: string): number | undefined => {
  const current = rawValue(frame, key);
  return typeof current === 'number' ? current : undefined;
};

const booleanValue = (frame: Telemetry, key: string): boolean | undefined => {
  const current = rawValue(frame, key);
  return typeof current === 'boolean' ? current : undefined;
};

const meanValues = (
  frame: Telemetry,
  keys: readonly string[]
): number | undefined => {
  const values = keys
    .map((key) => numberValue(frame, key))
    .filter((value): value is number => value !== undefined);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
};

const cornerValues = (
  frame: Telemetry,
  keys: readonly (string | readonly string[])[]
): number[] | undefined => {
  const values = keys.map((key) =>
    typeof key === 'string' ? numberValue(frame, key) : meanValues(frame, key)
  );
  return values.some((value) => value !== undefined)
    ? values.map((value) => value ?? Number.NaN)
    : undefined;
};

export class DriverControlsProcessor implements TelemetryProcessor<DriverControlsSnapshot> {
  readonly channel = 'driver-controls.snapshot';
  readonly tickRateHz = 60;

  private readonly latest: DriverControlsSnapshot = { version: 0 };

  init(session: Session): void {
    const shiftRpm = session.DriverInfo?.DriverCarSLShiftRPM;
    const blinkRpm = session.DriverInfo?.DriverCarSLBlinkRPM;
    const shiftChanged = this.set('shiftRpm', shiftRpm);
    const blinkChanged = this.set('blinkRpm', blinkRpm);
    if (shiftChanged || blinkChanged) this.latest.version += 1;
  }

  onFrame(frame: Telemetry): void {
    let changed = false;
    changed = this.set('brake', numberValue(frame, 'Brake')) || changed;
    changed = this.set('brakeRaw', numberValue(frame, 'BrakeRaw')) || changed;
    changed = this.set('throttle', numberValue(frame, 'Throttle')) || changed;
    changed =
      this.set('throttleRaw', numberValue(frame, 'ThrottleRaw')) || changed;
    changed = this.set('clutch', numberValue(frame, 'Clutch')) || changed;
    changed = this.set('clutchRaw', numberValue(frame, 'ClutchRaw')) || changed;
    changed = this.set('gear', numberValue(frame, 'Gear')) || changed;
    changed = this.set('speed', numberValue(frame, 'Speed')) || changed;
    changed =
      this.set('displayUnits', numberValue(frame, 'DisplayUnits')) || changed;
    changed =
      this.set(
        'steeringWheelAngle',
        numberValue(frame, 'SteeringWheelAngle')
      ) || changed;
    changed =
      this.set('brakeAbsActive', booleanValue(frame, 'BrakeABSactive')) ||
      changed;
    changed = this.set('rpm', numberValue(frame, 'RPM')) || changed;
    changed =
      this.set('shiftGrindRpm', numberValue(frame, 'ShiftGrindRPM')) || changed;
    changed = this.set('oilTemp', numberValue(frame, 'OilTemp')) || changed;
    changed = this.set('waterTemp', numberValue(frame, 'WaterTemp')) || changed;
    changed =
      this.set('engineWarnings', numberValue(frame, 'EngineWarnings')) ||
      changed;
    changed =
      this.set(
        'steeringWheelAngleMax',
        numberValue(frame, 'SteeringWheelAngleMax')
      ) || changed;
    changed =
      this.set('lateralAccel', numberValue(frame, 'LatAccel')) || changed;
    changed =
      this.set('longitudinalAccel', numberValue(frame, 'LongAccel')) || changed;
    changed =
      this.set(
        'tyreTemperature',
        cornerValues(frame, [
          ['LFtempCL', 'LFtempCM', 'LFtempCR'],
          ['RFtempCL', 'RFtempCM', 'RFtempCR'],
          ['LRtempCL', 'LRtempCM', 'LRtempCR'],
          ['RRtempCL', 'RRtempCM', 'RRtempCR'],
        ])
      ) || changed;
    changed =
      this.set(
        'tyrePressure',
        cornerValues(frame, [
          'LFcoldPressure',
          'RFcoldPressure',
          'LRcoldPressure',
          'RRcoldPressure',
        ])
      ) || changed;
    changed =
      this.set(
        'tyreWear',
        cornerValues(frame, [
          ['LFwearL', 'LFwearM', 'LFwearR'],
          ['RFwearL', 'RFwearM', 'RFwearR'],
          ['LRwearL', 'LRwearM', 'LRwearR'],
          ['RRwearL', 'RRwearM', 'RRwearR'],
        ])
      ) || changed;
    changed =
      this.set(
        'brakeLinePressure',
        cornerValues(frame, [
          'LFbrakeLinePress',
          'RFbrakeLinePress',
          'LRbrakeLinePress',
          'RRbrakeLinePress',
        ])
      ) || changed;
    changed =
      this.set(
        'suspensionDeflection',
        cornerValues(frame, [
          'LFshockDefl',
          'RFshockDefl',
          'LRshockDefl',
          'RRshockDefl',
        ])
      ) || changed;
    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    this.latest.brake = undefined;
    this.latest.brakeRaw = undefined;
    this.latest.throttle = undefined;
    this.latest.throttleRaw = undefined;
    this.latest.clutch = undefined;
    this.latest.clutchRaw = undefined;
    this.latest.gear = undefined;
    this.latest.speed = undefined;
    this.latest.displayUnits = undefined;
    this.latest.steeringWheelAngle = undefined;
    this.latest.brakeAbsActive = undefined;
    this.latest.rpm = undefined;
    this.latest.shiftGrindRpm = undefined;
    this.latest.oilTemp = undefined;
    this.latest.waterTemp = undefined;
    this.latest.engineWarnings = undefined;
    this.latest.shiftRpm = undefined;
    this.latest.blinkRpm = undefined;
    this.latest.steeringWheelAngleMax = undefined;
    this.latest.lateralAccel = undefined;
    this.latest.longitudinalAccel = undefined;
    this.latest.tyreTemperature = undefined;
    this.latest.tyrePressure = undefined;
    this.latest.tyreWear = undefined;
    this.latest.brakeLinePressure = undefined;
    this.latest.suspensionDeflection = undefined;
    this.latest.version += 1;
  }

  snapshot(): DriverControlsSnapshot {
    return this.latest;
  }

  private set<K extends Exclude<keyof DriverControlsSnapshot, 'version'>>(
    key: K,
    value: DriverControlsSnapshot[K]
  ): boolean {
    if (this.latest[key] === value) return false;
    this.latest[key] = value;
    return true;
  }
}
