import { describe, it, expect } from 'vitest';
import {
  isGamepadBinding,
  gamepadTokenFromIndex,
  gamepadTokenFromHat,
  gamepadComboToken,
  parseGamepadToken,
  parseGamepadTokens,
} from './gamepadToken';

describe('gamepad binding token helpers', () => {
  it('detects gamepad tokens vs keyboard accelerators', () => {
    expect(isGamepadBinding('gamepad:btn0')).toBe(true);
    expect(isGamepadBinding('gamepad:Logitech%20G29:btn3')).toBe(true);
    expect(isGamepadBinding('Alt+H')).toBe(false);
    expect(isGamepadBinding('F8')).toBe(false);
  });

  it('builds button and hat tokens with and without a device name', () => {
    expect(gamepadTokenFromIndex(5)).toBe('gamepad:btn5');
    expect(gamepadTokenFromIndex(5, 'Logitech G29')).toBe(
      'gamepad:Logitech%20G29:btn5'
    );
    expect(gamepadTokenFromHat(0, 'up')).toBe('gamepad:hat0_up');
    expect(gamepadTokenFromHat(0, 'downright', 'Xbox Pad')).toBe(
      'gamepad:Xbox%20Pad:hat0_downright'
    );
  });

  it('parses tokens back into device + control parts', () => {
    expect(parseGamepadToken('gamepad:btn5')).toEqual({ button: 'btn5' });
    expect(parseGamepadToken('gamepad:Logitech%20G29:btn5')).toEqual({
      device: 'Logitech G29',
      button: 'btn5',
    });
    expect(parseGamepadToken('gamepad:hat0_up')).toEqual({ button: 'hat0_up' });
    expect(
      parseGamepadToken(gamepadTokenFromHat(1, 'left', 'My:Wheel'))
    ).toEqual({ device: 'My:Wheel', button: 'hat1_left' });
    expect(parseGamepadToken('Alt+H')).toBeNull();
    expect(parseGamepadToken('gamepad:btn')).toBeNull();
    expect(parseGamepadToken('gamepad:Dev:nope')).toBeNull();
  });

  it('validates button and hat tokens with or without a device name', () => {
    expect(parseGamepadToken('gamepad:btn0')).not.toBeNull();
    expect(parseGamepadToken('gamepad:btn27')).not.toBeNull();
    expect(parseGamepadToken('gamepad:Fanatec%20CSL:btn12')).not.toBeNull();
    expect(parseGamepadToken('gamepad:hat0_up')).not.toBeNull();
    expect(
      parseGamepadToken('gamepad:Xbox%20Pad:hat0_downright')
    ).not.toBeNull();
    // Malformed / non-control tokens
    expect(parseGamepadToken('gamepad:btn')).toBeNull();
    expect(parseGamepadToken('gamepad:a')).toBeNull();
    expect(parseGamepadToken('gamepad:hat0')).toBeNull();
    expect(parseGamepadToken('gamepad:hat_up')).toBeNull();
    expect(parseGamepadToken('gamepad:hat0_unknown')).toBeNull();
    expect(parseGamepadToken('Alt+H')).toBeNull();
  });
});

describe('gamepad combo (chord) helpers', () => {
  it('builds a canonical, sorted combo regardless of input order', () => {
    expect(gamepadComboToken(['gamepad:btn5', 'gamepad:btn0'])).toBe(
      'gamepad:btn0+gamepad:btn5'
    );
    expect(gamepadComboToken(['gamepad:btn0', 'gamepad:btn5'])).toBe(
      'gamepad:btn0+gamepad:btn5'
    );
  });

  it('de-duplicates tokens when building a combo', () => {
    expect(gamepadComboToken(['gamepad:btn0', 'gamepad:btn0'])).toBe(
      'gamepad:btn0'
    );
  });

  it('round-trips a single token unchanged', () => {
    expect(gamepadComboToken(['gamepad:btn0'])).toBe('gamepad:btn0');
  });

  it('parses a combo into its individual valid tokens', () => {
    expect(parseGamepadTokens('gamepad:btn0+gamepad:btn1')).toEqual([
      'gamepad:btn0',
      'gamepad:btn1',
    ]);
    expect(parseGamepadTokens('gamepad:btn0')).toEqual(['gamepad:btn0']);
  });

  it('rejects a combo containing an invalid or non-gamepad part', () => {
    expect(parseGamepadTokens('gamepad:btn0+gamepad:nope')).toBeNull();
    expect(parseGamepadTokens('gamepad:btn0+Alt')).toBeNull();
    expect(parseGamepadTokens('Alt+H')).toBeNull();
  });
});
