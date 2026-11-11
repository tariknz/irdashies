import { describe, expect, it } from 'vitest';
import {
  getWidgetDefaultConfig,
  type DriverControlsSnapshot,
} from '@irdashies/types';
import { createInputSelector } from './inputSelection';

const config = () => structuredClone(getWidgetDefaultConfig('input'));
const frame = (
  changes: Partial<DriverControlsSnapshot> = {}
): DriverControlsSnapshot => ({
  brake: 0.2,
  throttle: 0.5,
  clutch: 0.9,
  gear: 3,
  speed: 10,
  steeringWheelAngle: 0.1,
  displayUnits: 1,
  brakeAbsActive: false,
  version: 1,
  ...changes,
});
const gearConfig = () => {
  const settings = config();
  settings.layoutTree = {
    id: 'gear',
    type: 'box',
    direction: 'row',
    widgets: ['gear'],
  };
  return settings;
};

describe('Input selection', () => {
  it.each([undefined, false, true])(
    'defaults trace steering when includeSteer is %s',
    (includeSteer) => {
      const settings = config();
      settings.layoutTree = {
        id: 'trace',
        type: 'box',
        direction: 'row',
        widgets: ['trace'],
      };
      settings.trace.includeSteer = includeSteer;
      const selected = createInputSelector(settings)(frame());
      expect(selected.steer).toBe(includeSteer === false ? undefined : 0.1);
    }
  );

  it('ignores RPM, unused pedals and version changes for a gear-only layout', () => {
    const select = createInputSelector(gearConfig());
    const first = select(frame());
    expect(select(frame({ version: 2, rpm: 7000, brake: 0.8 }))).toBe(first);
    expect(first.brake).toBeUndefined();
    expect(select(frame({ gear: 4 }))).not.toBe(first);
  });

  it('updates speed only when its displayed integer changes', () => {
    const select = createInputSelector(gearConfig());
    const first = select(frame({ speed: 10.01 }));
    expect(select(frame({ speed: 10.02, version: 2 }))).toBe(first);
    expect(select(frame({ speed: 10.2 }))).not.toBe(first);
  });

  it('uses the selected speed unit and reacts to auto-unit changes', () => {
    const settings = gearConfig();
    settings.gear.unit = 'mph';
    const select = createInputSelector(settings);
    const first = select(frame({ speed: 10.01 }));
    expect(select(frame({ speed: 10.02, displayUnits: 0 }))).toBe(first);
    const auto = createInputSelector(gearConfig());
    expect(auto(frame({ displayUnits: 0 })).unit).toBe(0);
    expect(auto(frame({ displayUnits: 1 })).unit).toBe(1);
  });

  it('does not wake a gear-only layout when hidden speed changes', () => {
    const settings = gearConfig();
    settings.gear.showspeed = false;
    const select = createInputSelector(settings);
    const first = select(frame());
    expect(select(frame({ speed: 100, displayUnits: 0 }))).toBe(first);
  });

  it('keeps full pedal and steering precision and inverts clutch', () => {
    const select = createInputSelector(config());
    const first = select(frame());
    expect(first.clutch).toBeCloseTo(0.1);
    const next = select(
      frame({ brake: 0.200001, steeringWheelAngle: 0.100001 })
    );
    expect(next.brake).toBe(0.200001);
    expect(next.steer).toBe(0.100001);
    expect(next).not.toBe(first);
  });

  it('uses raw pedals only when requested', () => {
    const settings = config();
    settings.useRawValues = true;
    const select = createInputSelector(settings);
    expect(
      select(
        frame({ brakeRaw: 0.123456, throttleRaw: 0.234567, clutchRaw: 0.3 })
      )
    ).toMatchObject({ brake: 0.123456, throttle: 0.234567, clutch: 0.7 });
  });

  it('advances visible trace samples even when controls are held constant', () => {
    const select = createInputSelector(config());
    const first = select(frame());
    const next = select(frame({ version: 2 }));
    expect(next).not.toBe(first);
    expect(next.traceTick).toBe(2);
  });

  it('reads the actual saved tree, including the ring gear display', () => {
    const settings = config();
    settings.steer.config = { style: 'ring', color: 'light' };
    settings.layoutTree = {
      id: 'ring',
      type: 'box',
      direction: 'row',
      widgets: ['steer'],
    };
    const select = createInputSelector(settings);
    expect(select(frame())).toMatchObject({ gear: 3, speed: 10, steer: 0.1 });
    expect(select(frame()).traceTick).toBeUndefined();
  });
});
