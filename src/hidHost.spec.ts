import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import { GamepadManager } from './app/gamepad/gamepadManager';

const host = vi.hoisted(() => ({
  onButton: undefined as ((token: string, down: boolean) => void) | undefined,
}));

vi.mock('./app/gamepad/gamepadHost', () => ({
  GamepadHost: class {
    start(onButton: (token: string, down: boolean) => void) {
      host.onButton = onButton;
    }
  },
}));
vi.mock('./app/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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

function report(device: EventTarget, buttons: number, hat = 8, reportId = 1) {
  device.dispatchEvent(
    Object.assign(new Event('inputreport'), {
      reportId,
      data: new DataView(new Uint8Array([buttons, hat]).buffer),
    })
  );
}

describe('HID host startup', () => {
  const trigger = vi.fn();
  const sendButton = vi.fn((token: string, down: boolean) =>
    host.onButton?.(token, down)
  );

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('gamepadHost', { sendButton });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function start(
    devices = [wheel()],
    accelerator = 'gamepad:Wheel:btn0'
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
    expect(sendButton).not.toHaveBeenCalled();

    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
    report(device, 0b10000000, 0);
    report(device, 0b10000001, 0);
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it('requires release and re-press for a button held at startup', async () => {
    const [device] = await start();
    report(device, 1);
    report(device, 1);
    expect(trigger).not.toHaveBeenCalled();
    report(device, 0);
    report(device, 1);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('initializes each report and device independently', async () => {
    const [device, other] = await start([wheel(), wheel('Other')]);
    report(device, 0);
    report(device, 0b10000000, 0, 2);
    report(other, 0b10000000, 0);
    expect(sendButton).not.toHaveBeenCalled();
    report(device, 1);
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
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
