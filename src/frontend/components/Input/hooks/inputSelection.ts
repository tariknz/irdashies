import type {
  DriverControlsSnapshot,
  InputConfig,
  LayoutNode,
} from '@irdashies/types';
import { resolveSpeedUnit, speedFromMs } from '@irdashies/utils/units';
import { getInputLayoutTree } from '../layout';

export interface InputValues {
  brake?: number;
  throttle?: number;
  clutch?: number;
  gear?: number;
  speed?: number;
  unit?: number;
  steer?: number;
  brakeAbsActive?: boolean;
  /** Keep sampling a visible trace even when every control is held steady. */
  traceTick?: number;
}

export const EMPTY_INPUTS: InputValues = {};

/** Select only visible controls, retaining the source clock for trace sampling. */
export function createInputSelector(config: InputConfig) {
  const elements = new Set<string>();
  const visit = (node: LayoutNode) => {
    if (node.type === 'box') node.widgets.forEach((id) => elements.add(id));
    else node.children.forEach(visit);
  };
  visit(getInputLayoutTree(config));
  const trace = elements.has('trace');
  const bar = elements.has('bar');
  const steer = elements.has('steer');
  const gear =
    elements.has('gear') || (steer && config.steer.config?.style === 'ring');
  const brakeWanted =
    (trace && config.trace.includeBrake) || (bar && config.bar.includeBrake);
  const throttleWanted =
    (trace && config.trace.includeThrottle) ||
    (bar && config.bar.includeThrottle);
  const clutchWanted =
    (trace && config.trace.includeClutch) || (bar && config.bar.includeClutch);
  const absWanted =
    elements.has('abs') ||
    (trace && config.trace.includeBrake && config.trace.includeAbs) ||
    (bar && config.bar.includeBrake && config.bar.includeAbs);
  const steerWanted = steer || (trace && (config.trace.includeSteer ?? true));
  const gearWanted = gear || !!config.gearFlash?.enabled;
  const speedWanted = gear && config.gear.showspeed;
  const brakeKey = config.useRawValues ? 'brakeRaw' : 'brake';
  const throttleKey = config.useRawValues ? 'throttleRaw' : 'throttle';
  const clutchKey = config.useRawValues ? 'clutchRaw' : 'clutch';
  let previous: InputValues | undefined;
  let previousSpeedText: string | undefined;

  return (snapshot: DriverControlsSnapshot): InputValues => {
    const brake = brakeWanted ? snapshot[brakeKey] : undefined;
    const throttle = throttleWanted ? snapshot[throttleKey] : undefined;
    const clutchRaw = clutchWanted ? snapshot[clutchKey] : undefined;
    const clutch = clutchRaw === undefined ? undefined : 1 - clutchRaw;
    const angle = steerWanted ? snapshot.steeringWheelAngle : undefined;
    const brakeAbsActive = absWanted ? snapshot.brakeAbsActive : undefined;
    const currentGear = gearWanted ? snapshot.gear : undefined;
    const unit =
      speedWanted && config.gear.unit === 'auto'
        ? snapshot.displayUnits
        : undefined;
    const speed = speedWanted ? snapshot.speed : undefined;
    const speedText = speedWanted
      ? speedFromMs(
          speed ?? 0,
          resolveSpeedUnit(config.gear.unit, unit)
        ).toFixed(0)
      : undefined;
    const traceTick = trace ? snapshot.version : undefined;
    if (
      previous &&
      previous.brake === brake &&
      previous.throttle === throttle &&
      previous.clutch === clutch &&
      previous.steer === angle &&
      previous.brakeAbsActive === brakeAbsActive &&
      previous.gear === currentGear &&
      previous.unit === unit &&
      previousSpeedText === speedText &&
      previous.traceTick === traceTick
    )
      return previous;

    previousSpeedText = speedText;
    // Allocate only when a displayed signal or the trace sampling clock changes.
    previous = {
      brake,
      throttle,
      clutch,
      steer: angle,
      brakeAbsActive,
      gear: currentGear,
      unit,
      speed,
      traceTick,
    };
    return previous;
  };
}
