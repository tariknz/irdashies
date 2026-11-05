import {
  createTranslator,
  normalizeText,
  type Translator,
} from './domTranslator';
import common from './ru/common';
import dialogs from './ru/dialogs';
import manifests from './ru/manifests';
import menu from './ru/menu';
import { ruPatterns } from './ru/patterns';
import sections from './ru/sections';

// Relative imports only: tools/ scripts load this file via tsx without
// path-alias or import.meta.glob support.

export const buildDictionary = (
  sources: Record<string, Readonly<Record<string, string>>>
): Map<string, string> => {
  const dict = new Map<string, string>();
  const origin = new Map<string, string>();
  for (const [source, entries] of Object.entries(sources)) {
    for (const [rawKey, value] of Object.entries(entries)) {
      const key = normalizeText(rawKey);
      const existing = dict.get(key);
      if (existing !== undefined && existing !== value) {
        throw new Error(
          `i18n: conflicting translations for "${key}" in ${origin.get(key)} and ${source}`
        );
      }
      if (existing === undefined) {
        dict.set(key, value);
        origin.set(key, source);
      }
    }
  }
  return dict;
};

export const ruDictionary: ReadonlyMap<string, string> = buildDictionary({
  common,
  menu,
  manifests,
  sections,
  dialogs,
});

export const ruTranslator: Translator = createTranslator(
  ruDictionary,
  ruPatterns
);
