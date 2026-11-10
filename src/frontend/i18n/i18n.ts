import type { AppLanguage } from '@irdashies/types';
import { DEFAULT_APP_LANGUAGE } from '@irdashies/types';
import { ptBR } from './locales/pt-BR';

/**
 * Gettext-style translation: the English text is the key, so a string with
 * no entry in the active dictionary simply shows in English. That keeps
 * English as the fallback for anything not yet translated, and keeps call
 * sites readable.
 *
 * `t()` reads a module-level language rather than React context so it can be
 * called anywhere inside a render (no hook rules). Never call it at module
 * scope: the result would be frozen in whatever language was active when the
 * module loaded. Translate at render time instead, e.g. `t(option.label)`.
 *
 * When the language changes, `<I18nProvider>` remounts its subtree so every
 * component renders again with the new dictionary, without restarting.
 */

export const SUPPORTED_LANGUAGES: readonly {
  value: AppLanguage;
  /** Shown in its own language so it is recognisable in either UI. */
  label: string;
}[] = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
];

const dictionaries: Record<AppLanguage, Readonly<Record<string, string>>> = {
  'pt-BR': ptBR,
  en: {},
};

let currentLanguage: AppLanguage = DEFAULT_APP_LANGUAGE;
const listeners = new Set<(language: AppLanguage) => void>();

export const isSupportedLanguage = (value: unknown): value is AppLanguage =>
  SUPPORTED_LANGUAGES.some((language) => language.value === value);

export const getLanguage = (): AppLanguage => currentLanguage;

/**
 * Makes `language` the active one for subsequent `t()` calls. Listeners are
 * told unless `notify` is false (used while rendering, where updating other
 * components is not allowed; the provider notifies from an effect instead).
 */
export const setLanguage = (language: AppLanguage, notify = true): void => {
  const next = isSupportedLanguage(language) ? language : DEFAULT_APP_LANGUAGE;
  if (next === currentLanguage) return;
  currentLanguage = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  if (notify) notifyLanguage();
};

export const notifyLanguage = (): void => {
  listeners.forEach((listener) => listener(currentLanguage));
};

export const subscribeLanguage = (
  listener: (language: AppLanguage) => void
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export type TranslationParams = Record<string, string | number>;

const interpolate = (text: string, params?: TranslationParams): string =>
  params
    ? text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match
      )
    : text;

/**
 * Translates `text` (English) into the active language. Placeholders such as
 * `{count}` are filled from `params` in either language. An absent text
 * (an optional label or description) passes through unchanged.
 */
export function t(text: string, params?: TranslationParams): string;
export function t(
  text: string | undefined,
  params?: TranslationParams
): string | undefined;
export function t(
  text: string | null | undefined,
  params?: TranslationParams
): string | null | undefined;
export function t(
  text: string | null | undefined,
  params?: TranslationParams
): string | null | undefined {
  if (text === undefined || text === null) return text;
  const translated = dictionaries[currentLanguage][text];
  return interpolate(translated ?? text, params);
}

/** Whether the active dictionary has an entry for `text`. */
export const hasTranslation = (text: string): boolean =>
  text in dictionaries[currentLanguage];
