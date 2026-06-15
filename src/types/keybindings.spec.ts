import { describe, it, expect } from 'vitest';
import {
  isGamepadBinding,
  gamepadToken,
  gamepadTokenFromIndex,
  gamepadButtonFromToken,
  isValidGamepadToken,
} from './keybindings';

describe('gamepad binding token helpers', () => {
  it('detects gamepad tokens vs keyboard accelerators', () => {
    expect(isGamepadBinding('gamepad:btn0')).toBe(true);
    expect(isGamepadBinding('gamepad:btn12')).toBe(true);
    expect(isGamepadBinding('Alt+H')).toBe(false);
    expect(isGamepadBinding('F8')).toBe(false);
  });

  it('builds and parses tokens round-trip', () => {
    expect(gamepadToken('btn3')).toBe('gamepad:btn3');
    expect(gamepadTokenFromIndex(5)).toBe('gamepad:btn5');
    expect(gamepadButtonFromToken('gamepad:btn7')).toBe('btn7');
    expect(gamepadButtonFromToken(gamepadTokenFromIndex(2))).toBe('btn2');
  });

  it('validates indexed button tokens', () => {
    expect(isValidGamepadToken('gamepad:btn0')).toBe(true);
    expect(isValidGamepadToken('gamepad:btn27')).toBe(true);
    // Malformed / non-indexed tokens
    expect(isValidGamepadToken('gamepad:btn')).toBe(false);
    expect(isValidGamepadToken('gamepad:a')).toBe(false);
    expect(isValidGamepadToken('gamepad:hat0_up')).toBe(false);
    // Not a gamepad token at all
    expect(isValidGamepadToken('Alt+H')).toBe(false);
  });
});
