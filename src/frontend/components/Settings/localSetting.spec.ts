import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocalSetting, writeLocalSetting } from './localSetting';

describe('local setting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps a value and reads it back', () => {
    expect(readLocalSetting('example')).toBeNull();
    writeLocalSetting('example', 'kept');
    expect(readLocalSetting('example')).toBe('kept');
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readLocalSetting('example')).toBeNull();
    expect(() => writeLocalSetting('example', 'kept')).not.toThrow();
  });
});
