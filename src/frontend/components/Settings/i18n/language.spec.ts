import { afterEach, describe, expect, it, vi } from 'vitest';
import logger from '@irdashies/utils/logger';
import {
  LANGUAGE_STORAGE_KEY,
  getSettingsLanguage,
  reloadOnLanguageChange,
  setSettingsLanguage,
} from './language';

describe('settings language storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to ru when nothing is stored', () => {
    expect(getSettingsLanguage()).toBe('ru');
  });

  it('returns en when en is stored', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(getSettingsLanguage()).toBe('en');
  });

  it('falls back to ru for unknown values', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    expect(getSettingsLanguage()).toBe('ru');
  });

  it('falls back to ru and warns when getItem throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getSettingsLanguage()).toBe('ru');
    expect(warn).toHaveBeenCalled();
  });

  it('reloads other windows when the stored language changes', () => {
    const reload = vi.fn();
    const stop = reloadOnLanguageChange(reload);
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    expect(reload).not.toHaveBeenCalled();
    window.dispatchEvent(
      new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'en' })
    );
    expect(reload).toHaveBeenCalledOnce();
    stop();
    window.dispatchEvent(
      new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'ru' })
    );
    expect(reload).toHaveBeenCalledOnce();
  });

  it('stores the language', () => {
    setSettingsLanguage('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('does not throw and warns when setItem throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setSettingsLanguage('en')).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
