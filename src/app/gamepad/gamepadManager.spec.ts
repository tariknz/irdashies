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
// passing a ready-made gamepad token.
const fireButton = (manager: GamepadManager, token: string) =>
  (
    manager as unknown as {
      handleButton: (token: string) => void;
    }
  ).handleButton(token);

describe('GamepadManager', () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
  });

  it('triggers the mapped action when its bound pad button is pressed', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    fireButton(manager, 'gamepad:btn0');

    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });

  it('does not trigger an action for an unbound pad button', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    fireButton(manager, 'gamepad:btn1');

    expect(trigger).not.toHaveBeenCalled();
  });

  it('forwards to the capture callback instead of triggering while recording', () => {
    const trigger = vi.fn();
    const manager = new GamepadManager(trigger);
    manager.syncBindings(gamepadBinding());

    const captured: string[] = [];
    manager.startCapture((token) => captured.push(token));
    fireButton(manager, 'gamepad:btn0');

    expect(captured).toEqual(['gamepad:btn0']);
    expect(trigger).not.toHaveBeenCalled();

    manager.stopCapture();
    fireButton(manager, 'gamepad:btn0');
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

    fireButton(manager, 'gamepad:btn0');
    expect(trigger).not.toHaveBeenCalled();

    fireButton(manager, 'gamepad:btn5');
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

    fireButton(manager, 'gamepad:B66E:btn10');

    expect(trigger).toHaveBeenCalledWith('toggle-edit-mode');
  });
});
