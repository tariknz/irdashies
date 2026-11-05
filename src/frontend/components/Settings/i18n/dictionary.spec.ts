import { describe, it, expect } from 'vitest';
import {
  WIDGET_MANIFESTS,
  type PropertySpecs,
  type WidgetManifest,
} from '@irdashies/types';
import { buildDictionary, ruDictionary, ruTranslator } from './dictionary';
import { normalizeText } from './domTranslator';
import { KEEP_AS_IS } from './ru/keepAsIs';
import { pluralRu } from './ru/patterns';

describe('buildDictionary', () => {
  it('normalizes keys', () => {
    const dict = buildDictionary({ a: { '  Gap ': 'Отставание' } });
    expect(dict.get('Gap')).toBe('Отставание');
  });

  it('throws on conflicting translations', () => {
    expect(() =>
      buildDictionary({ a: { Gap: 'Отставание' }, b: { Gap: 'Разрыв' } })
    ).toThrow('i18n: conflicting translations for "Gap" in a and b');
  });

  it('does not throw on identical translations', () => {
    expect(() =>
      buildDictionary({ a: { Gap: 'Отставание' }, b: { Gap: 'Отставание' } })
    ).not.toThrow();
  });
});

describe('ruDictionary hygiene', () => {
  const entries = [...ruDictionary.entries()];

  it('has no empty values', () => {
    expect(entries.filter(([, v]) => v.trim() === '')).toEqual([]);
  });

  it('has no value equal to its key', () => {
    expect(entries.filter(([k, v]) => k === v)).toEqual([]);
  });

  it('has no emoji in values', () => {
    expect(
      entries.filter(([, v]) => /\p{Extended_Pictographic}/u.test(v))
    ).toEqual([]);
  });
});

const manifestStrings = (manifest: WidgetManifest): string[] => {
  const strings = [manifest.name, manifest.menuLabel];
  const specs: PropertySpecs = manifest.properties ?? {};
  for (const spec of Object.values(specs)) {
    if (!spec) continue;
    strings.push(spec.label, spec.description);
    if (spec.type === 'number') strings.push(spec.units);
    if (spec.type === 'enum') {
      strings.push(...spec.options.map((option) => option.label));
    }
  }
  return strings.filter((s): s is string => s !== undefined);
};

describe('widget manifest coverage', () => {
  it('every manifest string is translated or kept', () => {
    const missing = [
      ...new Set(WIDGET_MANIFESTS.flatMap(manifestStrings)),
    ].filter(
      (s) =>
        /[A-Za-z]/.test(s) &&
        ruTranslator.translateText(s) === undefined &&
        !KEEP_AS_IS.has(normalizeText(s))
    );
    expect(missing).toEqual([]);
  });
});

describe('ruPatterns', () => {
  it.each([
    ['(3 hidden)', '(скрыто: 3)'],
    ['(showing 12 hidden)', '(показаны скрытые: 12)'],
    ['Enable Standings', 'Включить виджет «Таблица позиций»'],
    ['Enable Gantry', 'Включить виджет «Gantry»'],
    ['Not iRacing compatible', 'Несовместимо с iRacing'],
    ['Not Le Mans Ultimate compatible', 'Несовместимо с Le Mans Ultimate'],
    [': 2 s', ': 2 с'],
    [': 12 px', ': 12 px'],
    ['Reset showIcon, iconSize', 'Сбросить: showIcon, iconSize'],
    ['iRacing rating format', 'Формат рейтинга iRacing'],
    ['1 result', '1 результат'],
    ['3 results', '3 результата'],
    ['11 results', '11 результатов'],
    [
      'Showing first 120 of 1512 — search to filter',
      'Показаны первые 120 из 1512 — введите запрос для поиска',
    ],
    ["What's new in v2.1.0", 'Что нового в версии 2.1.0'],
    [
      'Change shortcut for Hide / Show UI',
      'Изменить сочетание: Скрыть / показать интерфейс',
    ],
    ['Change shortcut for Standings', 'Изменить сочетание: Таблица позиций'],
    [
      'Show / hide the Track Map widget',
      'Показать или скрыть виджет «Карта трассы»',
    ],
    [
      'Are you sure you want to delete the profile "Race night"? This action cannot be undone and all widget configurations for this profile will be permanently lost.',
      'Удалить профиль «Race night»? Это действие нельзя отменить: все настройки виджетов этого профиля будут безвозвратно потеряны.',
    ],
    [
      'Calibration reset for Spa. Pit entry and exit will be learned again as cars use the pit lane.',
      'Калибровка трассы «Spa» сброшена. Точки въезда на пит-лейн и выезда с него будут определены заново, когда машины проедут по пит-лейну.',
    ],
    [
      'Clear learned pit entry and exit positions for Spa? The overlay will relearn them as cars use the pit lane.',
      'Удалить определённые точки въезда на пит-лейн и выезда с него для трассы «Spa»? Оверлей определит их заново, когда машины проедут по пит-лейну.',
    ],
    [
      'Clear learned pit entry and exit positions for this track? The overlay will relearn them as cars use the pit lane.',
      'Удалить определённые точки въезда на пит-лейн и выезда с него для этой трассы? Оверлей определит их заново, когда машины проедут по пит-лейну.',
    ],
    // Fuel
    ['Average (3 Lap)', 'Среднее за 3 круга'],
    ['Average (10 Lap)', 'Среднее за 10 кругов'],
    ['Average (1)', 'Среднее за 1 круг'],
    ['Average (21 Laps)', 'Среднее за 21 круг'],
    ['Fuel Calculator Settings - fuel', 'Настройки расчёта топлива — fuel'],
    ['Input Traces - input-2', 'Графики педалей и руля — input-2'],
    ['Standings - standings-gantry-1', 'Таблица позиций — standings-gantry-1'],
    ['fuel-gantry-k3x9 (Gantry)', 'fuel-gantry-k3x9 (Gantry)'],
    // Gantry
    ['Use overlay: Fuel Calculator', 'Как на оверлее: Расчёт топлива'],
    ['Use overlay: fuel-2', 'Как на оверлее: fuel-2'],
    ['Gantry-only layout: fuel-gantry-1', 'Только для Gantry: fuel-gantry-1'],
    [
      'The Track Map widget is missing from this profile.',
      'Виджета «Карта трассы» нет в этом профиле.',
    ],
    [
      "Units for the speed settings on the Incidents tab. Values are always saved in km/h, so switching units never changes how incidents are detected. Auto follows iRacing's own unit setting, which is only known while the sim is running, so it shows km/h for now.",
      'Единицы для настроек скорости на вкладке «Инциденты». Значения всегда хранятся в км/ч, поэтому смена единиц не влияет на обнаружение инцидентов. «Авто» следует настройке единиц в iRacing, которая известна только при запущенном симуляторе, поэтому сейчас показаны км/ч.',
    ],
    [
      'Caps the top of the Gap axis at this many seconds. Cars further back ride along the top edge and the readout still shows their true gap. 0 turns the cap off. 0 to 600 seconds.',
      'Ограничивает ось «Отставание» сверху этим числом секунд. Машины, отставшие сильнее, идут по верхнему краю, а в подписи всё равно видно их настоящее отставание. 0 — без ограничения. От 0 до 600 с.',
    ],
    [
      'How many laps fit on the graph at once. It follows the latest lap, so earlier laps scroll off the left; you can still pan back to them. 5 to 300 laps.',
      'Сколько кругов помещается на графике одновременно. График следует за последним кругом, поэтому ранние круги уходят влево; к ним можно вернуться прокруткой. От 5 до 300 кругов.',
    ],
    [
      'Crash: Impact Severity (mph per second)',
      'Авария: сила удара (миль/ч в секунду)',
    ],
    ['Crash: Minimum Speed (km/h)', 'Авария: минимальная скорость (км/ч)'],
    ['Slow For (seconds)', 'Медленно в течение (с)'],
    // Lap Trace
    [
      'No best lap recorded yet for Spa — Porsche 911 GT3 R.',
      'Лучший круг для Spa — Porsche 911 GT3 R ещё не записан.',
    ],
    [
      'Delete your best lap for Spa — Porsche 911 GT3 R? This cannot be undone.',
      'Удалить ваш лучший круг для Spa — Porsche 911 GT3 R? Это действие нельзя отменить.',
    ],
    // Track Map
    [
      'Color each sector based on your session performance (purple: session best, green: within 0.5%, yellow: within 1%, red: 1%+ off pace). Thresholds are set in Sector Delta settings.',
      'Окрашивать каждый сектор по вашему результату в сессии (фиолетовый — лучший в сессии, зелёный — в пределах 0.5%, жёлтый — в пределах 1%, красный — медленнее на 1% и более). Пороги задаются в настройках «Дельта по секторам».',
    ],
    // Radar
    ['Reset Show Radar', 'Сбросить: Показывать радар'],
    ['Reset Close Cars Arc', 'Сбросить: Дуга «Близкие машины»'],
    ['Glow, set in Arcs', 'Свечение, настраивается в разделе «Дуги»'],
    [
      'Now: Daytona (oval), oval profile. Look, distances and warnings are kept per profile.',
      'Сейчас: Daytona (oval), профиль «Овал». Внешний вид, расстояния и предупреждения хранятся отдельно для каждого профиля.',
    ],
    [
      'Now: this track (road course), road profile. Look, distances and warnings are kept per profile.',
      'Сейчас: эта трасса (road course), профиль «Шоссе». Внешний вид, расстояния и предупреждения хранятся отдельно для каждого профиля.',
    ],
    ['Dive-Bomb Arc', 'Дуга «Атака сзади»'],
    ['Hazards Ahead Arc Length', 'Длина дуги «Опасность впереди»'],
    ['Close Cars Arc, Smallest', 'Дуга «Близкие машины»: наименьшая'],
    ['Close Cars Arc, Largest', 'Дуга «Близкие машины»: наибольшая'],
    [
      'Dive-Bomb is off, so this arc never shows.',
      'Модуль «Атака сзади» выключен, поэтому эта дуга не показывается.',
    ],
    [
      'Turn Hazards Ahead on first',
      'Сначала включите модуль «Опасность впереди»',
    ],
    ['Close Cars style', 'Стиль дуги «Близкие машины»'],
    ['Unknown settings: foo, bar', 'Неизвестные настройки: foo, bar'],
    [
      'Wrong type: range (expected number or null)',
      'Неверный тип: range (expected number or null)',
    ],
    ['Not valid JSON: Unexpected token', 'Неверный JSON: Unexpected token'],
  ])('%s -> %s', (text, expected) => {
    expect(ruTranslator.translateText(text)).toBe(expected);
  });

  it.each([
    // Only widget names get the widget switch wording.
    'Enable Something Else',
    // Unknown units or labels leave the whole string untranslated.
    ': 2 furlongs',
    'Change shortcut for Something Else',
    'Show / hide the Something Else widget',
    'Unknown Sim rating format',
    // Unknown widget names, labels and arc titles.
    'Something Else - widget-1',
    'Use overlay: Something Else',
    'The Something Else widget is missing from this profile.',
    'Something Else (km/h)',
    'Reset Something Else',
    'Something Else, set in Arcs',
    'Something Else Arc',
    'Turn Something Else on first',
    'Something Else style',
  ])('declines %s', (text) => {
    expect(ruTranslator.translateText(text)).toBeUndefined();
  });
});

describe('pluralRu', () => {
  const forms = { one: 'круг', few: 'круга', many: 'кругов' };
  it.each([
    [1, 'круг'],
    [3, 'круга'],
    [5, 'кругов'],
    [21, 'круг'],
    [22, 'круга'],
    [25, 'кругов'],
    [11, 'кругов'],
  ])('%i -> %s', (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});
