import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTranslator,
  normalizeText,
  startDomTranslation,
  type Pattern,
} from './domTranslator';

const DICT = new Map<string, string>([
  ['Hello', 'Привет'],
  ['Show', 'Показать'],
  ['Hide', 'Скрыть'],
  ['Count', 'Счёт'],
  ['Tooltip', 'Подсказка'],
  ['Show iRating', 'Показывать iRating'],
  ['Show only when on track', 'Показывать только на трассе'],
  ['Other tooltip', 'Другая подсказка'],
  ['Item one', 'Пункт один'],
  ['Item two', 'Пункт два'],
  ['Option A', 'Вариант А'],
  ['Option B', 'Вариант Б'],
]);

const flush = () => act(() => Promise.resolve());

const Demo = () => {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [cls, setCls] = useState('a');
  const [tip, setTip] = useState('Tooltip');
  const [items, setItems] = useState(['Item one', 'Item two']);
  const [sel, setSel] = useState('a');
  return (
    <div data-testid="root" className={cls}>
      <p data-testid="hello">Hello</p>
      <button data-testid="toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'}
      </button>
      {open && <p data-testid="cond">Hello</p>}
      <span data-testid="mixed">{count} Count</span>
      <button data-testid="inc" onClick={() => setCount((c) => c + 1)}>
        +
      </button>
      <button data-testid="cls" onClick={() => setCls((c) => c + 'x')}>
        cls
      </button>
      <i data-testid="tip" title={tip} />
      <button
        data-testid="tipbtn"
        onClick={() =>
          setTip((t) => (t === 'Tooltip' ? 'Other tooltip' : 'Tooltip'))
        }
      >
        tip
      </button>
      <ul data-testid="list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <button
        data-testid="rev"
        onClick={() => setItems((xs) => [...xs].reverse())}
      >
        rev
      </button>
      <select
        data-testid="sel"
        value={sel}
        onChange={(e) => setSel(e.target.value)}
      >
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </select>
    </div>
  );
};

describe('domTranslator', () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  describe('normalizeText', () => {
    it('trims and collapses whitespace', () => {
      expect(normalizeText('  Show only\n    when on track ')).toBe(
        'Show only when on track'
      );
    });
  });

  describe('createTranslator', () => {
    const patterns: Pattern[] = [
      { match: /^(\d+) laps$/, replace: (m) => `${m[1]} кругов` },
      { match: /^Hello$/, replace: () => 'Из шаблона' },
    ];
    const translator = createTranslator(DICT, patterns);

    it('keeps outer whitespace around the translation', () => {
      expect(translator.translateText(' Count')).toBe(' Счёт');
    });

    it('returns undefined for unknown and already translated text', () => {
      expect(translator.translateText('Unknown')).toBeUndefined();
      expect(translator.translateText('Привет')).toBeUndefined();
    });

    it('normalizes multi-line text before lookup', () => {
      expect(translator.translateText('Show only\n   when on track')).toBe(
        'Показывать только на трассе'
      );
    });

    it('applies patterns and prefers the dictionary', () => {
      expect(translator.translateText('5 laps')).toBe('5 кругов');
      expect(translator.translateText('Hello')).toBe('Привет');
    });
  });

  it('survives React re-renders', async () => {
    const translator = createTranslator(DICT, []);
    const { getByTestId, queryByTestId } = render(<Demo />);
    stop = startDomTranslation(document.body, translator);
    await flush();

    const click = async (id: string) => {
      await act(async () => {
        getByTestId(id).click();
      });
      await flush();
    };

    expect(getByTestId('hello').textContent).toBe('Привет');
    expect(getByTestId('toggle').textContent).toBe('Показать');
    expect(getByTestId('mixed').textContent).toBe('1 Счёт');
    expect(getByTestId('tip').getAttribute('title')).toBe('Подсказка');
    expect(getByTestId('list').textContent).toBe('Пункт одинПункт два');

    await click('toggle');
    expect(getByTestId('toggle').textContent).toBe('Скрыть');
    expect(getByTestId('cond').textContent).toBe('Привет');

    await click('toggle');
    expect(getByTestId('toggle').textContent).toBe('Показать');
    expect(queryByTestId('cond')).toBeNull();

    await click('inc');
    expect(getByTestId('mixed').textContent).toBe('2 Счёт');

    await click('cls');
    expect(getByTestId('hello').textContent).toBe('Привет');

    await click('tipbtn');
    expect(getByTestId('tip').getAttribute('title')).toBe('Другая подсказка');

    await click('rev');
    expect(getByTestId('list').textContent).toBe('Пункт дваПункт один');

    const select = getByTestId('sel') as HTMLSelectElement;
    expect(select.options[1].textContent).toBe('Вариант Б');
    await act(async () => {
      select.value = 'b';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    expect(select.value).toBe('b');
  });

  it('does not touch textarea/input values or skipped elements', async () => {
    const translator = createTranslator(DICT, []);
    const { container } = render(
      <div>
        <textarea defaultValue="Hello" />
        <input defaultValue="Hello" />
        <input placeholder="Hello" />
        <code>Hello</code>
        <kbd>Hello</kbd>
        <div translate="no">
          <span>Hello</span>
        </div>
      </div>
    );
    stop = startDomTranslation(document.body, translator);
    await flush();

    expect(container.querySelector('textarea')?.value).toBe('Hello');
    expect(container.querySelector('textarea')?.textContent).toBe('Hello');
    expect(container.querySelectorAll('input')[0].value).toBe('Hello');
    expect(container.querySelector('code')?.textContent).toBe('Hello');
    expect(container.querySelector('kbd')?.textContent).toBe('Hello');
    expect(container.querySelector('span')?.textContent).toBe('Hello');
    expect(container.querySelectorAll('input')[1].placeholder).toBe('Привет');
  });

  it('keeps monospace text and its descendants untranslated', async () => {
    const translator = createTranslator(new Map([['Speed', 'Скорость']]), []);
    const { container } = render(
      <div>
        <span className="rounded font-mono">Speed</span>
        <div className="font-mono">
          <b>Speed</b>
        </div>
        <p>Speed</p>
      </div>
    );
    stop = startDomTranslation(document.body, translator);
    await flush();

    expect(container.querySelector('span')?.textContent).toBe('Speed');
    expect(container.querySelector('b')?.textContent).toBe('Speed');
    expect(container.querySelector('p')?.textContent).toBe('Скорость');
  });

  it('settles when translation contains Latin', async () => {
    const base = createTranslator(DICT, []);
    const translateText = vi.fn((text: string) => base.translateText(text));
    const { container } = render(<p>Show iRating</p>);
    stop = startDomTranslation(document.body, { translateText });
    await flush();
    await flush();

    expect(container.querySelector('p')?.textContent).toBe(
      'Показывать iRating'
    );
    expect(translateText.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('reports missing once', async () => {
    const onMissing = vi.fn();
    const translator = createTranslator(DICT, []);
    render(
      <div>
        <p>Unknown text</p>
        <p>Unknown text</p>
        <p>42.1</p>
        <p>Привет</p>
      </div>
    );
    stop = startDomTranslation(document.body, translator, { onMissing });
    await flush();

    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(onMissing).toHaveBeenCalledWith('Unknown text');
  });

  it('stop() disconnects', async () => {
    const translator = createTranslator(DICT, []);
    const { container } = render(<div />);
    stop = startDomTranslation(document.body, translator);
    await flush();
    stop();
    stop = undefined;

    const p = document.createElement('p');
    p.textContent = 'Hello';
    container.appendChild(p);
    await flush();

    expect(p.textContent).toBe('Hello');
  });
});
