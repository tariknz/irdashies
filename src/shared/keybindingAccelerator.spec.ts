import { describe, expect, it } from 'vitest';
import { normalizeKeyboardAccelerator } from './keybindingAccelerator';
describe('keyboard accelerator comparison', () => {
  it.each([
    ['Ctrl+Shift+H', 'shift+control+h', false],
    ['CommandOrControl+H', 'Control+H', false],
    ['CmdOrCtrl+H', 'Cmd+H', true],
    ['Super+H', 'Command+H', true],
    ['Meta+H', 'Command+H', true],
    ['Super+H', 'Meta+H', false],
    ['Alt+Return', 'Option+Enter', true],
    ['Esc', 'Escape', false],
  ])('compares %s and %s on macOS=%s', (a, b, isMac) => {
    expect(normalizeKeyboardAccelerator(a, isMac)).toBe(
      normalizeKeyboardAccelerator(b, isMac)
    );
  });
  it('keeps Command and Control distinct on macOS', () => {
    expect(normalizeKeyboardAccelerator('CommandOrControl+H', true)).not.toBe(
      normalizeKeyboardAccelerator('Control+H', true)
    );
  });
});
