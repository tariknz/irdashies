import { describe, it, expect } from 'vitest';
import {
  isGamepadBinding,
  gamepadToken,
  gamepadButtonFromToken,
  isValidGamepadToken,
} from './keybindings';

describe('gamepad binding token helpers', () => {
  it('detects gamepad tokens vs keyboard accelerators', () => {
    expect(isGamepadBinding('gamepad:a')).toBe(true);
    expect(isGamepadBinding('gamepad:lefttrigger')).toBe(true);
    expect(isGamepadBinding('Alt+H')).toBe(false);
    expect(isGamepadBinding('F8')).toBe(false);
  });

  it('builds and parses tokens round-trip', () => {
    expect(gamepadToken('a')).toBe('gamepad:a');
    expect(gamepadButtonFromToken('gamepad:leftShoulder')).toBe('leftShoulder');
    expect(gamepadButtonFromToken(gamepadToken('dpadUp'))).toBe('dpadUp');
  });

  it('validates named controller buttons', () => {
    expect(isValidGamepadToken('gamepad:a')).toBe(true);
    expect(isValidGamepadToken('gamepad:rightTrigger')).toBe(true);
    expect(isValidGamepadToken('gamepad:paddle4')).toBe(true);
    // Unknown button name
    expect(isValidGamepadToken('gamepad:nope')).toBe(false);
    // Old lowercase SDL name is no longer valid
    expect(isValidGamepadToken('gamepad:righttrigger')).toBe(false);
    // Not a gamepad token at all
    expect(isValidGamepadToken('Alt+H')).toBe(false);
  });

  it('validates raw joystick button and hat tokens', () => {
    expect(isValidGamepadToken('gamepad:button0')).toBe(true);
    expect(isValidGamepadToken('gamepad:button27')).toBe(true);
    expect(isValidGamepadToken('gamepad:hat0_up')).toBe(true);
    expect(isValidGamepadToken('gamepad:hat1_rightdown')).toBe(true);
    // Malformed indexed tokens
    expect(isValidGamepadToken('gamepad:button')).toBe(false);
    expect(isValidGamepadToken('gamepad:hat0_diagonal')).toBe(false);
    expect(isValidGamepadToken('gamepad:hat_up')).toBe(false);
  });
});
