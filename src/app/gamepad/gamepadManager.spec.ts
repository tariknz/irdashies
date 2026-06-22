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

// Keep electron (pulled in transitively by gamepadHost) out of the test graph;
// these tests drive the manager's logic, never the host window.
vi.mock('./gamepadHost', () => ({ GamepadHost: vi.fn() }));

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
// passing a ready-made gamepad token and its press/release state.
const fireButton = (manager: GamepadManager, token: string, down = true) =>
  (
    manager as unknown as {
      handleButton: (token: string, down: boolean) => void;
    }
  ).handleButton(token, down);

const press = (manager: GamepadManager, token: string) =>
  fireButton(manager, token, true);
const release = (manager: GamepadManager, token: string) =>
  fireButton(manager, token, false);

describe('GamepadManager', () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
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

    it('does not fire on a 2-of-3 subset — an extra held button breaks the exact match', () => {
      const trigger = vi.fn();
      const manager = new GamepadManager(trigger);
      manager.syncBindings(comboBinding());

      press(manager, 'gamepad:btn2');
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
