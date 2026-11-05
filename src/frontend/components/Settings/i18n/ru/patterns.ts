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

export const ruPatterns: readonly Pattern[] = [
  // Settings menu: hidden (unsupported by the running sim) widgets toggle.
  {
    match: /^\((\d+) hidden\)$/,
    replace: ([, n]) => `(скрыто: ${n})`,
  },
  {
    match: /^\(showing (\d+) hidden\)$/,
    replace: ([, n]) => `(показаны скрытые: ${n})`,
  },
];
