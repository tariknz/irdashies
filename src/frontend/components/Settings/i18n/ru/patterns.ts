import type { Pattern } from '../domTranslator';

const pluralRules = new Intl.PluralRules('ru-RU');

export const pluralRu = (
  n: number,
  forms: { one: string; few: string; many: string }
): string => {
  const category = pluralRules.select(n);
  if (category === 'one') return forms.one;
  if (category === 'few' || category === 'other') return forms.few;
  return forms.many;
};

export const ruPatterns: readonly Pattern[] = [];
