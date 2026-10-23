import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import { GamepadManager } from './app/gamepad/gamepadManager';

type OnButton = (token: string, down: boolean, initial: boolean) => void;

const host = vi.hoisted(() => ({
  onButton: undefined as OnButton | undefined,
}));

vi.mock('./app/gamepad/gamepadHost', () => ({
  GamepadHost: class {
    start(onButton: OnButton) {
      host.onButton = onButton;
    }
    stop() {
      host.onButton = undefined;
    }
  },
}));
vi.mock('./app/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Build a wheel with vendor bits and a hat on two independent reports. */
function wheel(name = 'Wheel') {
  return Object.assign(new EventTarget(), {
    productName: name,
    opened: true,
    collections: [
      {
        inputReports: [1, 2].map((reportId) => ({
          reportId,
          items: [
            // Include vendor status bits, as real wheel descriptors do.
            { reportSize: 1, reportCount: 8, usages: [0xff000001] },
            {
              reportSize: 4,
              reportCount: 1,
              usages: [0x00010039],
              logicalMinimum: 0,
              logicalMaximum: 7,
            },
          ],
        })),
      },
    ],
  });
}

/** Deliver a WebHID report through the real host event handler. */
function report(device: EventTarget, buttons: number, hat = 8, reportId = 1) {
  device.dispatchEvent(
    Object.assign(new Event('inputreport'), {
      reportId,
      data: new DataView(new Uint8Array([buttons, hat]).buffer),
    })
  );
}

/**
 * A closed copy of `wheel()` whose collections declare the given top-level
 * usages (page, usage). The first one carries the wheel's input reports.
 */
function device(name: string, ...tops: [number, number][]) {
  const base = wheel(name);
  const collections = tops.map(([usagePage, usage], i) => ({
    usagePage,
    usage,
    inputReports: i === 0 ? base.collections[0].inputReports : [],
  }));
  return Object.assign(base, {
    opened: false,
    open: vi.fn().mockResolvedValue(undefined),
    collections: collections as unknown as typeof base.collections,
  });
}

describe('HID host startup', () => {
  const trigger = vi.fn();
  const sendButton = vi.fn((token: string, down: boolean, initial: boolean) =>
    host.onButton?.(token, down, initial)
  );

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('gamepadHost', { sendButton });
  });

  afterEach(() => vi.unstubAllGlobals());

  /**
   * Start the host with persisted bindings and route its edges to the manager.
   * With `onCapture`, the manager is recording a binding from the start.
   */
  async function start(
    devices = [wheel()],
    accelerator = 'gamepad:Wheel:btn0',
    onCapture?: (token: string) => void
  ) {
    const manager = new GamepadManager(trigger);
    manager.syncBindings({
      ...DEFAULT_KEYBINDINGS,
      'toggle-edit-mode': {
        ...DEFAULT_KEYBINDINGS['toggle-edit-mode'],
        accelerator,
      },
    });
    manager.start();
    if (onCapture) manager.startCapture(onCapture);
    vi.stubGlobal('navigator', {
      hid: Object.assign(new EventTarget(), {
        getDevices: vi.fn().mockResolvedValue(devices),
      }),
    });
    await import('./hidHost');
    return devices;
  }

  it('restores a binding with an initially active status bit and hat', async () => {
    const [device] = await start();
    report(device, 0b10000000, 0);
    expect(trigger).not.toHaveBeenCalled();

    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
    report(device, 0b10000000, 0);
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it('fires on the first event-driven press alongside active status bits', async () => {
    const [device] = await start();
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledTimes(1);
    report(device, 0b10000000, 0);
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it('fires a button and hat chord in the first report', async () => {
    const [device] = await start(
      [wheel()],
      'gamepad:Wheel:btn0+gamepad:Wheel:hat0_up'
    );
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('fires a hat binding in the first report', async () => {
    const [device] = await start([wheel()], 'gamepad:Wheel:hat0_up');
    report(device, 0b10000000, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('tracks each report and device independently', async () => {
    const [device, other] = await start([wheel(), wheel('Other')]);
    report(device, 0);
    report(device, 0b10000000, 0, 2);
    report(other, 0b10000000, 0);
    expect(trigger).not.toHaveBeenCalled();
    report(device, 1);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('fires on the first report after hotplug', async () => {
    await start([]);
    const device = wheel();
    navigator.hid.dispatchEvent(
      Object.assign(new Event('connect'), { device })
    );
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('never opens keyboards or mice, even ones with a multi-axis collection', async () => {
    // 2.4 GHz receivers often put a multi-axis collection next to the keyboard.
    const keyboard = device('RK Keyboard', [0x01, 0x08], [0x01, 0x06]);
    const mouse = device('Mouse', [0x01, 0x02]);

    await start([keyboard, mouse], 'gamepad:RK%20Keyboard:btn0');
    expect(keyboard.open).not.toHaveBeenCalled();
    expect(mouse.open).not.toHaveBeenCalled();
    report(keyboard, 0b10000001, 0);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('still opens a joystick-class wheel with vendor-page buttons', async () => {
    const joystick = device('Wheel', [0x01, 0x04]);

    await start([joystick]);
    expect(joystick.open).toHaveBeenCalledOnce();
    report(joystick, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('opens a button box that is both a gamepad and a keyboard', async () => {
    // Arduino-style boxes put Joystick and Keyboard collections on one interface.
    const box = device('Button Box', [0x01, 0x05], [0x01, 0x06]);

    await start([box], 'gamepad:Button%20Box:btn0');
    expect(box.open).toHaveBeenCalledOnce();
    report(box, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('does not open devices without any bindable control', async () => {
    const empty = device('Empty', [0xff00, 0x01]);
    empty.collections[0].inputReports = [];

    await start([empty]);
    expect(empty.open).not.toHaveBeenCalled();
  });

  it('records a press but not a control already held when recording started', async () => {
    const captured: string[] = [];
    // Nothing bound: the host starts for the recording itself.
    const [device] = await start([wheel()], '', (token) =>
      captured.push(token)
    );

    report(device, 0b10000000); // first report: bit 7 already held (a gear)
    report(device, 0b10000001); // press button 0
    report(device, 0b10000000); // release it

    expect(captured).toEqual(['gamepad:Wheel:btn0']);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('still matches button and hat chords after initialization', async () => {
    const [device] = await start(
      [wheel()],
      'gamepad:Wheel:btn0+gamepad:Wheel:hat0_up'
    );
    report(device, 0b10000000);
    report(device, 0b10000001);
    expect(trigger).not.toHaveBeenCalled();
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });
});
