import { useLayoutEffect } from 'react';
import logger from '@irdashies/utils/logger';
import { ruTranslator } from './dictionary';
import { startDomTranslation, type Translator } from './domTranslator';
import { getSettingsLanguage, type SettingsLanguage } from './language';

export interface SettingsTranslatorProps {
  language?: SettingsLanguage;
  translator?: Translator;
}

export const AppTranslator = ({
  language = getSettingsLanguage(),
  translator = ruTranslator,
}: SettingsTranslatorProps): null => {
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    if (language !== 'ru') return;

    const stop = startDomTranslation(document.body, translator, {
      onError: (error) => logger.warn('i18n: translation failed', error),
      onMissing: import.meta.env.DEV
        ? (text) => logger.debug('i18n missing:', text)
        : undefined,
    });

    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const translate = (message?: string) =>
      message === undefined
        ? message
        : (translator.translateText(String(message)) ?? message);
    window.alert = (message?: string) => originalAlert(translate(message));
    window.confirm = (message?: string) => originalConfirm(translate(message));

    return () => {
      stop();
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [language, translator]);

  return null;
};

// Backwards-compatible name for existing settings-window tests and stories.
export const SettingsTranslator = AppTranslator;
