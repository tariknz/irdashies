import logger from '@irdashies/utils/logger';

export type SettingsLanguage = 'ru' | 'en';

export const LANGUAGE_STORAGE_KEY = 'irdashies.settingsLanguage';

const DEFAULT_LANGUAGE: SettingsLanguage = 'ru';

export const getSettingsLanguage = (): SettingsLanguage => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'ru' ? stored : DEFAULT_LANGUAGE;
  } catch (error) {
    logger.warn('Failed to read settings language', error);
    return DEFAULT_LANGUAGE;
  }
};

export const setSettingsLanguage = (language: SettingsLanguage): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    logger.warn('Failed to store settings language', error);
  }
};
