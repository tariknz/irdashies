import { controller, joystick } from '@kmamal/sdl';
import logger from '../logger';

/** A normalized controller button-down, decoupled from the SDL library. */
export interface GamepadButtonEvent {
  /**
   * The pressed input. For recognized game controllers this is a named button
   * (e.g. "a", "dpadUp", "leftTrigger"). For raw joysticks (wheel bases, pedals,
   * unrecognized pads) it is an indexed token: "button<N>" or "hat<N>_<dir>".
   */
  button: string;
  /** Human-readable device name. */
  controller: string;
  /** Stable device GUID, or "" if unknown. */
  guid: string;
}

type ControllerDevice = (typeof controller.devices)[number];
type JoystickDevice = (typeof joystick.devices)[number];

/** Common surface of both SDL instance types that we use. */
interface OpenInstance {
  readonly closed: boolean;
  close(): void;
}

/** Triggers are analog axes; treat each as an edge-triggered pseudo-button. */
const TRIGGER_AXES = new Set(['leftTrigger', 'rightTrigger']);
const TRIGGER_THRESHOLD = 0.5;

/**
 * Reads game controllers, wheels and other joysticks via @kmamal/sdl and
 * forwards button presses to a callback. Deliberately knows nothing about
 * keybindings — the KeybindingManager owns the button -> action mapping.
 *
 * Every SDL device is a joystick; some are additionally recognized as "game
 * controllers" with a named-button mapping (a/b/x/dpadUp/…). We prefer the
 * controller API for readable names and fall back to the raw joystick API
 * (indexed buttons/hats) for wheel bases and anything SDL can't map — including
 * recognized pads whose controller mapping fails to open.
 *
 * node-sdl delivers input even while the app is unfocused (no window required),
 * which is what makes it usable for an overlay. It must be imported from the
 * main thread, so this module is loaded lazily from the Electron main process
 * (see KeybindingManager.startGamepad) and never pulled into tests.
 */
export class GamepadManager {
  private onButton?: (event: GamepadButtonEvent) => void;
  private opened = new Map<number, OpenInstance>();
  private triggerDown = new Map<string, boolean>();
  private hatPosition = new Map<string, string>();
  private deviceAddHandler?: (event: { device: JoystickDevice }) => void;
  private running = false;

  /**
   * Start reading devices. Safe to call repeatedly; a second call only swaps the
   * callback. Failures degrade gracefully (keyboard bindings keep working).
   */
  start(onButton: (event: GamepadButtonEvent) => void): void {
    this.onButton = onButton;
    if (this.running) return;
    this.running = true;

    try {
      // Every device shows up as a joystick; this single list covers gamepads,
      // wheels and pedals alike.
      for (const device of joystick.devices) this.openDevice(device);
      this.deviceAddHandler = (event) => this.openDevice(event.device);
      joystick.on('deviceAdd', this.deviceAddHandler);
      logger.info('[Gamepad] node-sdl input started');
    } catch (err) {
      logger.error('[Gamepad] failed to start controller input', err);
      this.running = false;
    }
  }

  private openDevice(device: JoystickDevice): void {
    if (this.opened.has(device.id)) return;

    // Prefer the named game-controller API when SDL recognizes this device.
    const controllerDevice = controller.devices.find((c) => c.id === device.id);
    if (controllerDevice && this.openAsController(controllerDevice)) return;

    // Wheel bases, pedals, unrecognized pads, or controllers whose mapping
    // failed to open: bind raw indexed buttons/hats.
    this.openAsJoystick(device);
  }

  private openAsController(device: ControllerDevice): boolean {
    let instance;
    try {
      instance = controller.openDevice(device);
    } catch (err) {
      logger.warn(
        `[Gamepad] "${device.name}" has no usable controller mapping, using raw joystick`,
        err
      );
      return false;
    }

    const id = device.id;
    this.opened.set(id, instance);
    const info = { controller: device.name, guid: device.guid ?? '' };

    instance.on('buttonDown', (event) => {
      this.onButton?.({ button: event.button, ...info });
    });
    instance.on('axisMotion', (event) => {
      if (!TRIGGER_AXES.has(event.axis)) return;
      const key = `${id}:${event.axis}`;
      const down = event.value > TRIGGER_THRESHOLD;
      const wasDown = this.triggerDown.get(key) ?? false;
      if (down && !wasDown) this.onButton?.({ button: event.axis, ...info });
      this.triggerDown.set(key, down);
    });
    instance.on('close', () => this.cleanup(id));
    return true;
  }

  private openAsJoystick(device: JoystickDevice): void {
    let instance;
    try {
      instance = joystick.openDevice(device);
    } catch (err) {
      logger.error(`[Gamepad] failed to open joystick "${device.name}"`, err);
      return;
    }

    const id = device.id;
    this.opened.set(id, instance);
    const info = { controller: device.name ?? '', guid: device.guid ?? '' };

    instance.on('buttonDown', (event) => {
      this.onButton?.({ button: `button${event.button}`, ...info });
    });
    // POV hats (common on wheel rims) — emit on transition to a non-centered
    // position so a hat direction can be bound like a button.
    instance.on('hatMotion', (event) => {
      const key = `${id}:hat${event.hat}`;
      const previous = this.hatPosition.get(key) ?? 'centered';
      if (event.value !== 'centered' && event.value !== previous) {
        this.onButton?.({ button: `hat${event.hat}_${event.value}`, ...info });
      }
      this.hatPosition.set(key, event.value);
    });
    instance.on('close', () => this.cleanup(id));
  }

  private cleanup(id: number): void {
    this.opened.delete(id);
    const prefix = `${id}:`;
    for (const key of [...this.triggerDown.keys()]) {
      if (key.startsWith(prefix)) this.triggerDown.delete(key);
    }
    for (const key of [...this.hatPosition.keys()]) {
      if (key.startsWith(prefix)) this.hatPosition.delete(key);
    }
  }

  stop(): void {
    try {
      this.detachDeviceAdd();
      for (const instance of this.opened.values()) {
        if (!instance.closed) instance.close();
      }
    } catch (err) {
      logger.error('[Gamepad] failed to stop controller input', err);
    }
    this.opened.clear();
    this.triggerDown.clear();
    this.hatPosition.clear();
    this.onButton = undefined;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private detachDeviceAdd(): void {
    if (!this.deviceAddHandler) return;
    // node-sdl's module is an EventEmitter at runtime, but its types only expose
    // `on`; reach for `off`/`removeListener` defensively.
    const emitter = joystick as unknown as {
      off?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        listener: (...args: unknown[]) => void
      ) => void;
    };
    const remove = emitter.off ?? emitter.removeListener;
    remove?.call(joystick, 'deviceAdd', this.deviceAddHandler as never);
    this.deviceAddHandler = undefined;
  }
}
