import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseCustomSwitches,
  filterCustomSwitches,
  getChromiumFlags,
  saveChromiumFlags,
} from './chromiumFlags';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

vi.mock('../logger', () => ({
  default: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('chromiumFlags', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
    mockLoggerWarn.mockReset();
  });

  describe('parseCustomSwitches', () => {
    it('returns an empty array for empty or whitespace input', () => {
      expect(parseCustomSwitches('')).toEqual([]);
      expect(parseCustomSwitches('   \n  \n\t')).toEqual([]);
    });

    it('parses a bare switch name', () => {
      expect(parseCustomSwitches('disable-gpu-vsync')).toEqual([
        { name: 'disable-gpu-vsync' },
      ]);
    });

    it('parses a switch with a value', () => {
      expect(parseCustomSwitches('force-color-profile=srgb')).toEqual([
        { name: 'force-color-profile', value: 'srgb' },
      ]);
    });

    it('strips a leading double-dash', () => {
      expect(parseCustomSwitches('--disable-gpu-vsync')).toEqual([
        { name: 'disable-gpu-vsync' },
      ]);
    });

    it('ignores blank lines and comment lines', () => {
      const input = `
# this is a comment
disable-gpu-vsync

  # indented comment
force-color-profile=srgb
`;
      expect(parseCustomSwitches(input)).toEqual([
        { name: 'disable-gpu-vsync' },
        { name: 'force-color-profile', value: 'srgb' },
      ]);
    });

    it('trims whitespace around names and values', () => {
      expect(parseCustomSwitches('   force-color-profile  =  srgb  ')).toEqual([
        { name: 'force-color-profile', value: 'srgb' },
      ]);
    });

    it('handles CRLF line endings', () => {
      expect(
        parseCustomSwitches('disable-gpu-vsync\r\nuse-gl=desktop')
      ).toEqual([
        { name: 'disable-gpu-vsync' },
        { name: 'use-gl', value: 'desktop' },
      ]);
    });
  });

  describe('filterCustomSwitches', () => {
    it('keeps switches on the allowlist', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'disable-gpu-vsync\nforce-color-profile=srgb'
      );
      expect(sanitized).toBe('disable-gpu-vsync\nforce-color-profile=srgb');
      expect(dropped).toEqual([]);
    });

    it('drops switches not on the allowlist', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'remote-debugging-port=9222'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['remote-debugging-port']);
    });

    it('drops disable-web-security', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'disable-web-security'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['disable-web-security']);
    });

    it('drops proxy-server', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'proxy-server=http://evil.example.com:8080'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['proxy-server']);
    });

    it('drops js-flags', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'js-flags=--allow-natives-syntax'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['js-flags']);
    });

    it('drops user-data-dir (profile redirection)', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'user-data-dir=C:\\attacker'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['user-data-dir']);
    });

    it('drops load-extension', () => {
      const { sanitized, dropped } = filterCustomSwitches(
        'load-extension=C:\\attacker\\ext'
      );
      expect(sanitized).toBe('');
      expect(dropped).toEqual(['load-extension']);
    });

    it('preserves allowed entries while dropping bad ones in the same input', () => {
      const input = [
        'disable-gpu-vsync',
        'remote-debugging-port=9222',
        'force-color-profile=srgb',
        'disable-web-security',
      ].join('\n');
      const { sanitized, dropped } = filterCustomSwitches(input);
      expect(sanitized).toBe('disable-gpu-vsync\nforce-color-profile=srgb');
      expect(dropped).toEqual([
        'remote-debugging-port',
        'disable-web-security',
      ]);
    });

    it('returns empty sanitized string when input is empty', () => {
      expect(filterCustomSwitches('')).toEqual({ sanitized: '', dropped: [] });
    });
  });

  describe('saveChromiumFlags', () => {
    it('persists only allowlisted switches and logs a warning for dropped ones', () => {
      const saved = saveChromiumFlags({
        disableNativeWinOcclusion: false,
        angleBackend: 'default',
        disableDirectComposition: false,
        disableFeatures: [],
        enableFeatures: [],
        customSwitches: 'disable-gpu-vsync\nremote-debugging-port=9222',
      });

      expect(saved.customSwitches).toBe('disable-gpu-vsync');
      expect(mockWriteData).toHaveBeenCalledWith(
        'chromiumFlags',
        expect.objectContaining({ customSwitches: 'disable-gpu-vsync' })
      );
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[chromiumFlags] Dropped custom switches not in allowlist:',
        ['remote-debugging-port']
      );
    });

    it('coerces an invalid angleBackend to "default"', () => {
      const saved = saveChromiumFlags({
        disableNativeWinOcclusion: false,
        // @ts-expect-error testing an invalid value rejected at runtime
        angleBackend: 'evil',
        disableDirectComposition: false,
        disableFeatures: [],
        enableFeatures: [],
        customSwitches: '',
      });
      expect(saved.angleBackend).toBe('default');
    });

    it('does not warn when customSwitches is empty', () => {
      saveChromiumFlags({
        disableNativeWinOcclusion: false,
        angleBackend: 'default',
        disableDirectComposition: false,
        disableFeatures: [],
        enableFeatures: [],
        customSwitches: '',
      });
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });
  });

  describe('getChromiumFlags', () => {
    it('strips dangerous switches even when reading pre-existing bad data from disk', () => {
      mockReadData.mockReturnValueOnce({
        disableNativeWinOcclusion: false,
        angleBackend: 'default',
        disableDirectComposition: false,
        disableFeatures: [],
        enableFeatures: [],
        customSwitches:
          'disable-gpu-vsync\nremote-debugging-port=9222\ndisable-web-security',
      });

      const result = getChromiumFlags();
      expect(result.customSwitches).toBe('disable-gpu-vsync');
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[chromiumFlags] Dropped custom switches not in allowlist:',
        ['remote-debugging-port', 'disable-web-security']
      );
    });

    it('returns defaults when nothing is persisted', () => {
      mockReadData.mockReturnValueOnce(null);
      const result = getChromiumFlags();
      expect(result.customSwitches).toBe('');
      expect(result.angleBackend).toBe('default');
    });
  });
});
