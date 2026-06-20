import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import type { KeybindingsMap } from '@irdashies/types';
import {
  getKeybindings,
  updateKeybinding,
  resetKeybinding,
} from './keybindings';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

describe('keybindings storage', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
  });

  describe('getKeybindings', () => {
    it('seeds defaults when nothing is stored', () => {
      mockReadData.mockReturnValue(undefined);
      const result = getKeybindings();
      expect(result).toEqual(DEFAULT_KEYBINDINGS);
      expect(mockWriteData).toHaveBeenCalledWith(
        'keybindings',
        DEFAULT_KEYBINDINGS
      );
    });

    it('preserves stored dynamic widget-toggle entries through the merge', () => {
      const stored: Partial<KeybindingsMap> = {
        'toggle-widget:standings': {
          accelerator: 'Alt+1',
          label: 'Standings',
          description: 'Show / hide the Standings widget',
          isDefault: false,
        },
      };
      mockReadData.mockReturnValue(stored);

      const result = getKeybindings();
      expect(result['toggle-widget:standings']).toEqual(
        stored['toggle-widget:standings']
      );
      // Static defaults still present
      expect(result['toggle-hide-ui']).toEqual(
        DEFAULT_KEYBINDINGS['toggle-hide-ui']
      );
    });

    it('keeps stored overrides of static actions', () => {
      mockReadData.mockReturnValue({
        'toggle-hide-ui': {
          accelerator: 'Alt+G',
          label: 'Hide / Show UI',
          description: 'Toggle visibility of all overlay windows',
          isDefault: false,
        },
      });
      const result = getKeybindings();
      expect(result['toggle-hide-ui'].accelerator).toBe('Alt+G');
    });
  });

  describe('updateKeybinding', () => {
    it('creates a dynamic widget entry with provided label/description', () => {
      mockReadData.mockReturnValue({ ...DEFAULT_KEYBINDINGS });
      const result = updateKeybinding('toggle-widget:fuel', 'Alt+2', {
        label: 'Fuel Calculator',
        description: 'Show / hide the Fuel Calculator widget',
      });
      expect(result['toggle-widget:fuel']).toEqual({
        accelerator: 'Alt+2',
        label: 'Fuel Calculator',
        description: 'Show / hide the Fuel Calculator widget',
        isDefault: false,
      });
      expect(mockWriteData).toHaveBeenCalled();
    });

    it('removes a dynamic entry when unbound (empty accelerator)', () => {
      mockReadData.mockReturnValue({
        ...DEFAULT_KEYBINDINGS,
        'toggle-widget:fuel': {
          accelerator: 'Alt+2',
          label: 'Fuel Calculator',
          description: 'Show / hide the Fuel Calculator widget',
          isDefault: false,
        },
      });
      const result = updateKeybinding('toggle-widget:fuel', '');
      expect(result['toggle-widget:fuel']).toBeUndefined();
    });

    it('does not treat empty accelerators as conflicts', () => {
      mockReadData.mockReturnValue({
        ...DEFAULT_KEYBINDINGS,
        'toggle-widget:fuel': {
          accelerator: '',
          label: 'Fuel Calculator',
          description: '',
          isDefault: true,
        },
      });
      expect(() =>
        updateKeybinding('toggle-widget:standings', '', {
          label: 'Standings',
          description: '',
        })
      ).not.toThrow();
    });

    it('throws when binding a key already in use', () => {
      mockReadData.mockReturnValue({ ...DEFAULT_KEYBINDINGS });
      expect(() =>
        updateKeybinding('toggle-widget:fuel', 'Alt+H', {
          label: 'Fuel Calculator',
          description: '',
        })
      ).toThrow(/already bound/);
    });
  });

  describe('resetKeybinding', () => {
    it('unbinds (removes) a dynamic widget entry', () => {
      mockReadData.mockReturnValue({
        ...DEFAULT_KEYBINDINGS,
        'toggle-widget:fuel': {
          accelerator: 'Alt+2',
          label: 'Fuel Calculator',
          description: '',
          isDefault: false,
        },
      });
      const result = resetKeybinding('toggle-widget:fuel');
      expect(result['toggle-widget:fuel']).toBeUndefined();
    });

    it('restores a static action to its factory binding', () => {
      mockReadData.mockReturnValue({
        ...DEFAULT_KEYBINDINGS,
        'toggle-hide-ui': {
          accelerator: 'Alt+G',
          label: 'Hide / Show UI',
          description: 'Toggle visibility of all overlay windows',
          isDefault: false,
        },
      });
      const result = resetKeybinding('toggle-hide-ui');
      expect(result['toggle-hide-ui']).toEqual(
        DEFAULT_KEYBINDINGS['toggle-hide-ui']
      );
    });
  });
});
