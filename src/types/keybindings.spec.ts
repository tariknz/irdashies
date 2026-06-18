import { describe, it, expect } from 'vitest';
import {
  isGamepadBinding,
  gamepadTokenFromIndex,
  parseGamepadToken,
  isValidGamepadToken,
} from './keybindings';

describe('gamepad binding token helpers', () => {
  it('detects gamepad tokens vs keyboard accelerators', () => {
    expect(isGamepadBinding('gamepad:btn0')).toBe(true);
    expect(isGamepadBinding('gamepad:Logitech%20G29:btn3')).toBe(true);
    expect(isGamepadBinding('Alt+H')).toBe(false);
    expect(isGamepadBinding('F8')).toBe(false);
  });

  it('builds tokens with and without a device name', () => {
    expect(gamepadTokenFromIndex(5)).toBe('gamepad:btn5');
    expect(gamepadTokenFromIndex(5, 'Logitech G29')).toBe(
      'gamepad:Logitech%20G29:btn5'
    );
  });

  it('parses tokens back into device + button parts', () => {
    expect(parseGamepadToken('gamepad:btn5')).toEqual({ button: 'btn5' });
    expect(parseGamepadToken('gamepad:Logitech%20G29:btn5')).toEqual({
      device: 'Logitech G29',
      button: 'btn5',
    });
    expect(parseGamepadToken(gamepadTokenFromIndex(2, 'My:Wheel'))).toEqual({
      device: 'My:Wheel',
      button: 'btn2',
    });
    expect(parseGamepadToken('Alt+H')).toBeNull();
    expect(parseGamepadToken('gamepad:btn')).toBeNull();
    expect(parseGamepadToken('gamepad:Dev:nope')).toBeNull();
  });

  it('validates button tokens with or without a device name', () => {
    expect(isValidGamepadToken('gamepad:btn0')).toBe(true);
    expect(isValidGamepadToken('gamepad:btn27')).toBe(true);
    expect(isValidGamepadToken('gamepad:Fanatec%20CSL:btn12')).toBe(true);
    // Malformed / non-button tokens
    expect(isValidGamepadToken('gamepad:btn')).toBe(false);
    expect(isValidGamepadToken('gamepad:a')).toBe(false);
    expect(isValidGamepadToken('gamepad:hat0_up')).toBe(false);
    expect(isValidGamepadToken('Alt+H')).toBe(false);
  });
});
