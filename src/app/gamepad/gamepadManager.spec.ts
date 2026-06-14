import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Device {
  id: number;
  name: string;
  guid: string;
}
interface FakeInstance {
  device: Device;
  closed: boolean;
  listeners: Map<string, (e: unknown) => void>;
  on: (event: string, cb: (e: unknown) => void) => FakeInstance;
  emit: (event: string, payload: unknown) => void;
  close: () => void;
}

// A fake @kmamal/sdl module (used for both `controller` and `joystick`),
// hoisted so the vi.mock factory below can reference it.
const sdlMock = vi.hoisted(() => {
  const makeModule = () => {
    const moduleListeners = new Map<string, (e: unknown) => void>();
    const devices: Device[] = [];
    const openInstances: FakeInstance[] = [];
    let openThrows = false;

    const mod = {
      devices,
      setOpenThrows(value: boolean) {
        openThrows = value;
      },
      openDevice(device: Device) {
        if (openThrows) {
          throw new Error('SDL_GameControllerGetButton() error: 0 hats');
        }
        const listeners = new Map<string, (e: unknown) => void>();
        const instance: FakeInstance = {
          device,
          closed: false,
          listeners,
          on(event, cb) {
            listeners.set(event, cb);
            return instance;
          },
          emit(event, payload) {
            listeners.get(event)?.(payload);
          },
          close() {
            instance.closed = true;
            instance.emit('close', { type: 'close' });
          },
        };
        openInstances.push(instance);
        return instance;
      },
      on(event: string, cb: (e: unknown) => void) {
        moduleListeners.set(event, cb);
        return mod;
      },
      off(event: string) {
        moduleListeners.delete(event);
        return mod;
      },
    };

    return { mod, moduleListeners, devices, openInstances };
  };

  return { controller: makeModule(), joystick: makeModule() };
});

vi.mock('@kmamal/sdl', () => ({
  controller: sdlMock.controller.mod,
  joystick: sdlMock.joystick.mod,
}));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GamepadManager } from './gamepadManager';

const device = (id: number): Device => ({
  id,
  name: `Dev ${id}`,
  guid: `guid-${id}`,
});

/** Register a device as a recognized game controller (appears in both lists). */
const addController = (d: Device) => {
  sdlMock.joystick.devices.push(d);
  sdlMock.controller.devices.push(d);
};

/** Register a device as a raw joystick only (wheel base, pedals, etc.). */
const addJoystick = (d: Device) => {
  sdlMock.joystick.devices.push(d);
};

describe('GamepadManager (node-sdl)', () => {
  beforeEach(() => {
    for (const m of [sdlMock.controller, sdlMock.joystick]) {
      m.devices.length = 0;
      m.openInstances.length = 0;
      m.moduleListeners.clear();
      m.mod.setOpenThrows(false);
    }
  });

  it('opens recognized game controllers with named buttons', () => {
    addController(device(1));
    const onButton = vi.fn();

    new GamepadManager().start(onButton);

    expect(sdlMock.controller.openInstances).toHaveLength(1);
    expect(sdlMock.joystick.openInstances).toHaveLength(0);
    sdlMock.controller.openInstances[0].emit('buttonDown', { button: 'a' });
    expect(onButton).toHaveBeenCalledWith({
      button: 'a',
      controller: 'Dev 1',
      guid: 'guid-1',
    });
  });

  it('opens a raw joystick (wheel base) with indexed buttons', () => {
    addJoystick(device(2));
    const onButton = vi.fn();

    new GamepadManager().start(onButton);

    expect(sdlMock.controller.openInstances).toHaveLength(0);
    expect(sdlMock.joystick.openInstances).toHaveLength(1);
    sdlMock.joystick.openInstances[0].emit('buttonDown', { button: 5 });
    expect(onButton).toHaveBeenCalledWith({
      button: 'button5',
      controller: 'Dev 2',
      guid: 'guid-2',
    });
  });

  it('falls back to the raw joystick when the controller mapping fails to open', () => {
    addController(device(3));
    sdlMock.controller.mod.setOpenThrows(true); // simulates the F710 "0 hats" error
    const onButton = vi.fn();

    new GamepadManager().start(onButton);

    expect(sdlMock.controller.openInstances).toHaveLength(0);
    expect(sdlMock.joystick.openInstances).toHaveLength(1);
    sdlMock.joystick.openInstances[0].emit('buttonDown', { button: 0 });
    expect(onButton).toHaveBeenCalledWith({
      button: 'button0',
      controller: 'Dev 3',
      guid: 'guid-3',
    });
  });

  it('opens hot-plugged devices via the joystick deviceAdd event', () => {
    const onButton = vi.fn();
    new GamepadManager().start(onButton);
    expect(sdlMock.joystick.openInstances).toHaveLength(0);

    sdlMock.joystick.moduleListeners.get('deviceAdd')?.({ device: device(4) });
    expect(sdlMock.joystick.openInstances).toHaveLength(1);
  });

  it('emits a controller trigger pseudo-button once, on the rising edge only', () => {
    addController(device(1));
    const onButton = vi.fn();
    new GamepadManager().start(onButton);
    const inst = sdlMock.controller.openInstances[0];

    inst.emit('axisMotion', { axis: 'leftTrigger', value: 0.2 });
    expect(onButton).not.toHaveBeenCalled();
    inst.emit('axisMotion', { axis: 'leftTrigger', value: 0.8 });
    expect(onButton).toHaveBeenCalledTimes(1);
    expect(onButton).toHaveBeenCalledWith({
      button: 'leftTrigger',
      controller: 'Dev 1',
      guid: 'guid-1',
    });
    inst.emit('axisMotion', { axis: 'leftTrigger', value: 0.9 });
    expect(onButton).toHaveBeenCalledTimes(1);
  });

  it('emits a joystick POV-hat token once, on transition to a direction', () => {
    addJoystick(device(2));
    const onButton = vi.fn();
    new GamepadManager().start(onButton);
    const inst = sdlMock.joystick.openInstances[0];

    inst.emit('hatMotion', { hat: 0, value: 'centered' });
    expect(onButton).not.toHaveBeenCalled();
    inst.emit('hatMotion', { hat: 0, value: 'up' });
    expect(onButton).toHaveBeenCalledTimes(1);
    expect(onButton).toHaveBeenCalledWith({
      button: 'hat0_up',
      controller: 'Dev 2',
      guid: 'guid-2',
    });
    inst.emit('hatMotion', { hat: 0, value: 'up' }); // held
    inst.emit('hatMotion', { hat: 0, value: 'centered' }); // released
    expect(onButton).toHaveBeenCalledTimes(1);
  });

  it('stop() closes devices, detaches deviceAdd and stops forwarding', () => {
    addJoystick(device(2));
    const onButton = vi.fn();
    const manager = new GamepadManager();
    manager.start(onButton);
    const inst = sdlMock.joystick.openInstances[0];

    manager.stop();

    expect(inst.closed).toBe(true);
    expect(sdlMock.joystick.moduleListeners.has('deviceAdd')).toBe(false);
    expect(manager.isRunning()).toBe(false);

    inst.emit('buttonDown', { button: 0 });
    expect(onButton).not.toHaveBeenCalled();
  });

  it('is idempotent — a second start does not reopen devices', () => {
    addJoystick(device(2));
    const manager = new GamepadManager();

    manager.start(vi.fn());
    manager.start(vi.fn());

    expect(sdlMock.joystick.openInstances).toHaveLength(1);
    expect(manager.isRunning()).toBe(true);
  });
});
