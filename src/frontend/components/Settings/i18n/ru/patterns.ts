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

const LAPS = { one: 'круг', few: 'круга', many: 'кругов' };
// After "до" / "от … до": genitive.
const LAPS_GENITIVE = { one: 'круга', few: 'кругов', many: 'кругов' };
// A widget id such as "fuel" or "fuel-gantry-k3x9": data, shown as is.
const WIDGET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Patterns for text built with template literals. A pattern that embeds
 * another string (a widget name, a unit) declines when that string is
 * unknown, so it is still reported as missing.
 */
export const createRuPatterns = (lookup: Lookup): readonly Pattern[] => {
  // Translated, or kept as is when it must stay English (iRacing, px).
  const term = (text: string): string | undefined =>
    lookup(text) ?? (KEEP_AS_IS.has(text) ? text : undefined);
  // Like term, but also tries the patterns (e.g. "Close Cars Arc").
  const deep = (text: string): string | undefined => {
    const found = term(text);
    if (found !== undefined) return found;
    for (const { match, replace } of patterns) {
      const result = text.match(match);
      const translated = result ? replace(result) : undefined;
      if (translated !== undefined) return translated;
    }
    return undefined;
  };
  const patterns: Pattern[] = [
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
    // Fuel: consumption grid row and pit strategy basis, e.g. "Average (3 Lap)".
    {
      match: /^Average \((\d+)(?: Laps?)?\)$/,
      replace: ([, n]) => `Среднее за ${n} ${pluralRu(Number(n), LAPS)}`,
    },
    // Page title of an extra widget instance, e.g. "Input Traces - input-2".
    {
      match: /^(.+) - (\S+)$/,
      replace: ([, name, id]) => {
        const title = term(name);
        return title && `${title} — ${id}`;
      },
    },
    // Gantry: where a docked fuel panel or the standings come from.
    {
      match: /^Use overlay: (.+)$/,
      replace: ([, name]) => {
        const source = term(name) ?? (WIDGET_ID.test(name) ? name : undefined);
        return source && `Как на оверлее: ${source}`;
      },
    },
    {
      match: /^Gantry-only layout: (\S+)$/,
      replace: ([, id]) => `Только для Gantry: ${id}`,
    },
    {
      match: /^The (.+) widget is missing from this profile\.$/,
      replace: ([, name]) => {
        const widget = term(name);
        return widget && `Виджета «${widget}» нет в этом профиле.`;
      },
    },
    // Fuel layout picker: a Gantry-only layout's id stays as is.
    {
      match: /^(\S+) \(Gantry\)$/,
      replace: ([whole, id]) => (WIDGET_ID.test(id) ? whole : undefined),
    },
    // Gantry: speed unit help while Auto cannot be resolved yet.
    {
      match:
        /^Units for the speed settings on the Incidents tab\. Values are always saved in km\/h, so switching units never changes how incidents are detected\. Auto follows iRacing's own unit setting, which is only known while the sim is running, so it shows (.+) for now\.$/,
      replace: ([, units]) => {
        const unit = term(units);
        return (
          unit &&
          `Единицы для настроек скорости на вкладке «Инциденты». Значения всегда хранятся в км/ч, поэтому смена единиц не влияет на обнаружение инцидентов. «Авто» следует настройке единиц в iRacing, которая известна только при запущенном симуляторе, поэтому сейчас показаны ${unit}.`
        );
      },
    },
    // Gantry lap graph limits.
    {
      match:
        /^Caps the top of the Gap axis at this many seconds\. Cars further back ride along the top edge and the readout still shows their true gap\. 0 turns the cap off\. (\d+) to (\d+) seconds\.$/,
      replace: ([, min, max]) =>
        `Ограничивает ось «Отставание» сверху этим числом секунд. Машины, отставшие сильнее, идут по верхнему краю, а в подписи всё равно видно их настоящее отставание. 0 — без ограничения. От ${min} до ${max} с.`,
    },
    {
      match:
        /^How many laps fit on the graph at once\. It follows the latest lap, so earlier laps scroll off the left; you can still pan back to them\. (\d+) to (\d+) laps\.$/,
      replace: ([, min, max]) =>
        `Сколько кругов помещается на графике одновременно. График следует за последним кругом, поэтому ранние круги уходят влево; к ним можно вернуться прокруткой. От ${min} до ${max} ${pluralRu(Number(max), LAPS_GENITIVE)}.`,
    },
    // Gantry incident thresholds: the label plus its unit.
    {
      match: /^(.+) \((km\/h|mph) per second\)$/,
      replace: ([, label, units]) => {
        const title = term(label);
        return title && `${title} (${term(units)} в секунду)`;
      },
    },
    {
      match: /^(.+) \((km\/h|mph)\)$/,
      replace: ([, label, units]) => {
        const title = term(label);
        return title && `${title} (${term(units)})`;
      },
    },
    {
      match: /^(.+) \(seconds\)$/,
      replace: ([, label]) => {
        const title = term(label);
        return title && `${title} (с)`;
      },
    },
    // Lap Trace: the personal best of the current track and car.
    {
      match: /^No best lap recorded yet for (.+) — (.+)\.$/,
      replace: ([, track, car]) =>
        `Лучший круг для ${track} — ${car} ещё не записан.`,
    },
    {
      match: /^Delete your best lap for (.+) — (.+)\? This cannot be undone\.$/,
      replace: ([, track, car]) =>
        `Удалить ваш лучший круг для ${track} — ${car}? Это действие нельзя отменить.`,
    },
    // Track Map: sector colouring thresholds from the Sector Delta settings.
    {
      match:
        /^Color each sector based on your session performance \(purple: session best, green: within ([\d.]+)%, yellow: within ([\d.]+)%, red: ([\d.]+)%\+ off pace\)\. Thresholds are set in Sector Delta settings\.$/,
      replace: ([, green, yellow, red]) =>
        `Окрашивать каждый сектор по вашему результату в сессии (фиолетовый — лучший в сессии, зелёный — в пределах ${green}%, жёлтый — в пределах ${yellow}%, красный — медленнее на ${red}% и более). Пороги задаются в настройках «Дельта по секторам».`,
    },
    // Radar: the changed dot of a setting, labelled with its title.
    {
      match: /^Reset (.+)$/,
      replace: ([, title]) => {
        const name = deep(title);
        return name && `Сбросить: ${name}`;
      },
    },
    // Radar: a module's rim arc, set in the Arcs section.
    {
      match: /^(.+), set in Arcs$/,
      replace: ([, style]) => {
        const name = term(style);
        return name && `${name}, настраивается в разделе «Дуги»`;
      },
    },
    {
      match:
        /^Now: (.+) \(([^()]+)\), (oval|road) profile\. Look, distances and warnings are kept per profile\.$/,
      replace: ([, track, type, profile]) =>
        `Сейчас: ${track === 'this track' ? 'эта трасса' : track} (${type}), профиль «${
          profile === 'oval' ? 'Овал' : 'Шоссе'
        }». Внешний вид, расстояния и предупреждения хранятся отдельно для каждого профиля.`,
    },
    {
      match: /^(.+) Arc$/,
      replace: ([, title]) => {
        const name = term(title);
        return name && `Дуга «${name}»`;
      },
    },
    {
      match: /^(.+) Arc Length$/,
      replace: ([, title]) => {
        const name = term(title);
        return name && `Длина дуги «${name}»`;
      },
    },
    {
      match: /^(.+) Arc, (Smallest|Largest)$/,
      replace: ([, title, size]) => {
        const name = term(title);
        return (
          name &&
          `Дуга «${name}»: ${size === 'Smallest' ? 'наименьшая' : 'наибольшая'}`
        );
      },
    },
    {
      match: /^(.+) is off, so this arc never shows\.$/,
      replace: ([, module]) => {
        const name = term(module);
        return (
          name && `Модуль «${name}» выключен, поэтому эта дуга не показывается.`
        );
      },
    },
    {
      match: /^Turn (.+) on first$/,
      replace: ([, module]) => {
        const name = term(module);
        return name && `Сначала включите модуль «${name}»`;
      },
    },
    {
      match: /^(.+) style$/,
      replace: ([, title]) => {
        const name = term(title);
        return name && `Стиль дуги «${name}»`;
      },
    },
    // Radar export/import errors; the listed setting names stay as is.
    {
      match: /^Unknown settings: (.+)$/,
      replace: ([, names]) => `Неизвестные настройки: ${names}`,
    },
    {
      match: /^Wrong type: (.+)$/,
      replace: ([, names]) => `Неверный тип: ${names}`,
    },
    {
      match: /^Not valid JSON: (.+)$/,
      replace: ([, message]) => `Неверный JSON: ${message}`,
    },
  ];
  return patterns;
};
