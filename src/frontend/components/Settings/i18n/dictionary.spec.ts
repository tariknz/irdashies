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
