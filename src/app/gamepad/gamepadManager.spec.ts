import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KeybindingsMap } from '@irdashies/types';

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

const hostSpies = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));

// Keep electron (pulled in transitively by gamepadHost) out of the test graph;
// these tests drive the manager's logic, never the host window. A `function`
// so `new` works; returning the spies makes every instance share them.
vi.mock('./gamepadHost', () => ({
  GamepadHost: function () {
    return hostSpies;
  },
}));

import { GamepadManager } from './gamepadManager';

const gamepadBinding = (): KeybindingsMap =>
  ({
    'toggle-edit-mode': {
      accelerator: 'gamepad:btn0',
      label: 'Edit Layout',
      description: '',
      isDefault: false,
    },
  }) as unknown as KeybindingsMap;

// handleButton is private; the WebHID host callback is its only caller,
// passing a ready-made gamepad token, its press/release state and whether it
// is the control's first edge since its device was opened.
const fireButton = (
  manager: GamepadManager,
  token: string,
  down = true,
  initial = false
) =>
  (
    manager as unknown as {
      handleButton: (token: string, down: boolean, initial: boolean) => void;
    }
  ).handleButton(token, down, initial);

const press = (manager: GamepadManager, token: string) =>
  fireButton(manager, token, true);
const release = (manager: GamepadManager, token: string) =>
  fireButton(manager, token, false);

describe('GamepadManager', () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
    hostSpies.start.mockReset();
    hostSpies.stop.mockReset();
  });

  describe('WebHID host lifecycle', () => {
    const keyboardBinding = (): KeybindingsMap =>
      ({
        'toggle-edit-mode': {
          ...gamepadBinding()['toggle-edit-mode'],
          accelerator: 'Ctrl+Shift+E',
        },
      }) as unknown as KeybindingsMap;

    it('does not start the host without gamepad bindings', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(keyboardBinding());
      manager.start();

      expect(hostSpies.start).not.toHaveBeenCalled();
    });

    it('starts the host once when a pad binding is added', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(keyboardBinding());
      manager.start();

      manager.syncBindings(gamepadBinding());
      expect(hostSpies.start).toHaveBeenCalledOnce();

      manager.syncBindings(gamepadBinding());
      expect(hostSpies.start).toHaveBeenCalledOnce();
      expect(hostSpies.stop).not.toHaveBeenCalled();
    });

    it('stops the host when the last pad binding is removed', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(gamepadBinding());
      manager.start();

      manager.syncBindings(keyboardBinding());
      expect(hostSpies.stop).toHaveBeenCalledOnce();
    });

    it('runs the host only while recording when there are no pad bindings', () => {
      const manager = new GamepadManager(vi.fn());
      manager.start();

      manager.startCapture(vi.fn());
      expect(hostSpies.start).toHaveBeenCalledOnce();
      expect(hostSpies.stop).not.toHaveBeenCalled();

      manager.stopCapture();
      expect(hostSpies.stop).toHaveBeenCalledOnce();
    });

    it('keeps the host running through a recording when pad bindings exist', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(gamepadBinding());
      manager.start();

      manager.startCapture(vi.fn());
      manager.stopCapture();
      expect(hostSpies.start).toHaveBeenCalledOnce();
      expect(hostSpies.stop).not.toHaveBeenCalled();
    });

    it('starts nothing before start()', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(gamepadBinding());
      manager.startCapture(vi.fn());
      manager.stopCapture();

      expect(hostSpies.start).not.toHaveBeenCalled();
    });

    it('tears the host down on stop()', () => {
      const manager = new GamepadManager(vi.fn());
      manager.syncBindings(gamepadBinding());
      manager.start();

      manager.stop();
      expect(hostSpies.stop).toHaveBeenCalledOnce();

      manager.syncBindings(gamepadBinding());
      expect(hostSpies.start).toHaveBeenCalledOnce();
    });
  });

  it('triggers the mapped action when its bound pad button is pressed', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    press(manager, 'gamepad:btn0');

    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });

  it('does not trigger an action for an unbound pad button', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    press(manager, 'gamepad:btn1');

    expect(trigger).not.toHaveBeenCalled();
  });

  it('does not retrigger a held binding when an unbound status bit changes', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());
    press(manager, 'gamepad:btn0');
    press(manager, 'gamepad:btn7');
    release(manager, 'gamepad:btn7');
    expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
  });

  it('forwards the captured combo to the capture callback on first release, instead of triggering', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    const captured: string[] = [];
    manager.startCapture((token) => captured.push(token));
    press(manager, 'gamepad:btn0');
    expect(captured).toEqual([]); // not yet committed — waiting for a release
    release(manager, 'gamepad:btn0');

    expect(captured).toEqual(['gamepad:btn0']);
    expect(trigger).not.toHaveBeenCalled();

    manager.stopCapture();
    press(manager, 'gamepad:btn0');
    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });

  it('rebuilds the token map on syncBindings, dropping stale tokens', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    // Rebind the action to a different button.
    manager.syncBindings({
      'toggle-edit-mode': {
        accelerator: 'gamepad:btn5',
        label: 'Edit Layout',
        description: '',
        isDefault: false,
      },
    } as unknown as KeybindingsMap);

    press(manager, 'gamepad:btn0');
    release(manager, 'gamepad:btn0');
    expect(trigger).not.toHaveBeenCalled();

    press(manager, 'gamepad:btn0'); // Old binding must no longer block the new one.
    press(manager, 'gamepad:btn5');
    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });

  it('maps device-specific tokens (gamepad:<device>:btn<N>)', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings({
      'toggle-edit-mode': {
        accelerator: 'gamepad:B66E:btn10',
        label: 'Edit Layout',
        description: '',
        isDefault: false,
      },
    } as unknown as KeybindingsMap);

    press(manager, 'gamepad:B66E:btn10');

    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });

  describe('combos (chords)', () => {
    const comboBinding = (): KeybindingsMap =>
      ({
        'toggle-edit-mode': {
          accelerator: 'gamepad:btn0+gamepad:btn1',
          label: 'Edit Layout',
          description: '',
          isDefault: false,
        },
      }) as unknown as KeybindingsMap;

    it('fires when the second button completes the bound chord, regardless of press order', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings(comboBinding());

      press(manager, 'gamepad:btn1');
      expect(trigger).not.toHaveBeenCalled();
      press(manager, 'gamepad:btn0');
      expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
    });

    it('ignores unbound held controls when matching a chord', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings(comboBinding());

      press(manager, 'gamepad:btn2');
      press(manager, 'gamepad:btn0');
      press(manager, 'gamepad:btn1');

      expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
    });

    it('does not match a subset when the extra control belongs to another binding', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings({
        ...comboBinding(),
        'toggle-hide-ui': {
          ...gamepadBinding()['toggle-edit-mode'],
          accelerator: 'gamepad:btn2',
        },
      });
      press(manager, 'gamepad:btn2');
      trigger.mockClear();
      press(manager, 'gamepad:btn0');
      press(manager, 'gamepad:btn1');
      expect(trigger).not.toHaveBeenCalled();
    });

    it('re-fires after releasing and re-pressing one button of the chord', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings(comboBinding());

      press(manager, 'gamepad:btn0');
      press(manager, 'gamepad:btn1');
      expect(trigger).toHaveBeenCalledTimes(1);

      release(manager, 'gamepad:btn1');
      press(manager, 'gamepad:btn1');
      expect(trigger).toHaveBeenCalledTimes(2);
    });

    it('captures a chord and commits it as a canonical, order-independent combo', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);

      const captured: string[] = [];
      manager.startCapture((token) => captured.push(token));
      press(manager, 'gamepad:btn1');
      press(manager, 'gamepad:btn0');
      release(manager, 'gamepad:btn1');

      expect(captured).toEqual(['gamepad:btn0+gamepad:btn1']);
    });

    it('does not record controls that were already held when recording started', () => {
      const manager = new GamepadManager(vi.fn());

      const captured: string[] = [];
      manager.startCapture((token) => captured.push(token));
      // A shifter in gear reports its held button in the first report.
      fireButton(manager, 'gamepad:Gear:btn1', true, true);
      press(manager, 'gamepad:Wheel:btn4');
      release(manager, 'gamepad:Wheel:btn4');

      expect(captured).toEqual(['gamepad:Wheel:btn4']);
    });

    it('still triggers a bound action from an initial edge outside recording', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings(gamepadBinding());

      fireButton(manager, 'gamepad:btn0', true, true);

      expect(trigger).toHaveBeenCalledExactlyOnceWith('toggle-edit-mode');
    });

    it('fires a button + hat-direction combo once both are held', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings({
        'toggle-edit-mode': {
          accelerator: 'gamepad:btn0+gamepad:hat0_up',
          label: 'Edit Layout',
          description: '',
          isDefault: false,
        },
      } as unknown as KeybindingsMap);

      press(manager, 'gamepad:btn0');
      expect(trigger).not.toHaveBeenCalled();
      press(manager, 'gamepad:hat0_up');

      expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
    });

    it('releasing a hat direction (centering) drops it from the held set', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings({
        'toggle-edit-mode': {
          accelerator: 'gamepad:btn0+gamepad:hat0_up',
          label: 'Edit Layout',
          description: '',
          isDefault: false,
        },
      } as unknown as KeybindingsMap);

      press(manager, 'gamepad:hat0_up');
      release(manager, 'gamepad:hat0_up'); // centered
      press(manager, 'gamepad:btn0');

      expect(trigger).not.toHaveBeenCalled();
    });
  });
});
