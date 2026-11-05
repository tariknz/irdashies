import type { Pattern } from '../domTranslator';
import { KEEP_AS_IS } from './keepAsIs';
import menu from './menu';

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

/** Looks a whole English string up in the dictionary. */
export type Lookup = (text: string) => string | undefined;

const widgetNames: ReadonlyMap<string, string> = new Map(Object.entries(menu));

/**
 * Patterns for text built with template literals. A pattern that embeds
 * another string (a widget name, a unit) declines when that string is
 * unknown, so it is still reported as missing.
 */
export const createRuPatterns = (lookup: Lookup): readonly Pattern[] => {
  // Translated, or kept as is when it must stay English (iRacing, px).
  const term = (text: string): string | undefined =>
    lookup(text) ?? (KEEP_AS_IS.has(text) ? text : undefined);
  return [
    // Settings menu: hidden (unsupported by the running sim) widgets toggle.
    {
      match: /^\((\d+) hidden\)$/,
      replace: ([, n]) => `(скрыто: ${n})`,
    },
    {
      match: /^\(showing (\d+) hidden\)$/,
      replace: ([, n]) => `(показаны скрытые: ${n})`,
    },
    // Settings menu: the widget switch's accessible name.
    {
      match: /^Enable (.+)$/,
      replace: ([, label]) => {
        const name = widgetNames.get(label);
        return name && `Включить виджет «${name}»`;
      },
    },
    // Widget page header under a greyed-out switch.
    {
      match: /^Not (.+) compatible$/,
      replace: ([, sim]) => `Несовместимо с ${sim}`,
    },
    // Slider row value after the title, e.g. ": 2 s".
    {
      match: /^: (-?\d+(?:\.\d+)?) (.+)$/,
      replace: ([, n, units]) => {
        const unit = term(units);
        return unit && `: ${n} ${unit}`;
      },
    },
    // Changed-setting dot: aria-label lists the config keys it resets.
    {
      match: /^Reset ([a-z]\w*(?:, [a-z]\w*)*)$/,
      replace: ([, keys]) => `Сбросить: ${keys}`,
    },
    // Rating format picker, labelled with the simulator name.
    {
      match: /^(.+) rating format$/,
      replace: ([, sim]) => {
        const name = term(sim);
        return name && `Формат рейтинга ${name}`;
      },
    },
    // Icon picker search results.
    {
      match: /^(\d+) results?$/,
      replace: ([, n]) =>
        `${n} ${pluralRu(Number(n), {
          one: 'результат',
          few: 'результата',
          many: 'результатов',
        })}`,
    },
    {
      match: /^Showing first (\d+) of (\d+) — search to filter$/,
      replace: ([, shown, total]) =>
        `Показаны первые ${shown} из ${total} — введите запрос для поиска`,
    },
    // Release notes dialog title.
    {
      match: /^What's new in v(\S+)$/,
      replace: ([, version]) => `Что нового в версии ${version}`,
    },
    // Key Bindings page.
    {
      match: /^Change shortcut for (.+)$/,
      replace: ([, label]) => {
        const name = term(label);
        return name && `Изменить сочетание: ${name}`;
      },
    },
    {
      match: /^Show \/ hide the (.+) widget$/,
      replace: ([, label]) => {
        const name = term(label);
        return name && `Показать или скрыть виджет «${name}»`;
      },
    },
    // Profiles page: delete confirmation.
    {
      match:
        /^Are you sure you want to delete the profile "(.*)"\? This action cannot be undone and all widget configurations for this profile will be permanently lost\.$/,
      replace: ([, name]) =>
        `Удалить профиль «${name}»? Это действие нельзя отменить: все настройки виджетов этого профиля будут безвозвратно потеряны.`,
    },
    // Pit lane calibration (Pitlane Helper page).
    {
      match:
        /^Calibration reset for (.+)\. Pit entry and exit will be learned again as cars use the pit lane\.$/,
      replace: ([, track]) =>
        `Калибровка трассы «${track}» сброшена. Точки въезда на пит-лейн и выезда с него будут определены заново, когда машины проедут по пит-лейну.`,
    },
    {
      match:
        /^Clear learned pit entry and exit positions for (.+)\? The overlay will relearn them as cars use the pit lane\.$/,
      replace: ([, track]) =>
        `Удалить определённые точки въезда на пит-лейн и выезда с него для ${
          track === 'this track' ? 'этой трассы' : `трассы «${track}»`
        }? Оверлей определит их заново, когда машины проедут по пит-лейну.`,
    },
  ];
};
