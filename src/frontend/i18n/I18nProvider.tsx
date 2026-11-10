import { Fragment, useEffect, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import type { AppLanguage } from '@irdashies/types';
import { DEFAULT_APP_LANGUAGE } from '@irdashies/types';
import {
  getLanguage,
  isSupportedLanguage,
  notifyLanguage,
  setLanguage,
  subscribeLanguage,
} from './i18n';

interface I18nProviderProps {
  /** Language from the dashboard's general settings; unset means the default. */
  language?: AppLanguage;
}

/**
 * Applies the configured language and remounts its children when it changes,
 * so every `t()` call renders again in the new language without a restart.
 */
export const I18nProvider = ({
  language,
  children,
}: PropsWithChildren<I18nProviderProps>) => {
  const active = isSupportedLanguage(language)
    ? language
    : DEFAULT_APP_LANGUAGE;
  // Applied during render so this very render is already translated; other
  // subscribers hear about it after commit.
  setLanguage(active, false);
  useEffect(() => notifyLanguage(), [active]);
  return <Fragment key={active}>{children}</Fragment>;
};

/** The active language; re-renders the caller when it changes. */
export const useLanguage = (): AppLanguage =>
  useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
