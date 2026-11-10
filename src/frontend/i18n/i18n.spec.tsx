import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { I18nProvider } from './I18nProvider';
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, t } from './i18n';

// The test setup swaps in an empty dictionary; these specs need the real one.
vi.unmock('./locales/pt-BR');
const { ptBR } =
  await vi.importActual<typeof import('./locales/pt-BR')>('./locales/pt-BR');

const placeholders = (text: string) =>
  (text.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('t', () => {
  afterEach(() => setLanguage('en'));

  it('defaults to Brazilian Portuguese', async () => {
    vi.resetModules();
    const fresh = await import('./i18n');
    expect(fresh.getLanguage()).toBe('pt-BR');
  });

  it('translates into Portuguese and falls back to English', () => {
    setLanguage('pt-BR');
    expect(t('Display')).toBe(ptBR.Display);
    expect(t('Options')).toBe('Opções');
    expect(t('Not a key in any dictionary')).toBe(
      'Not a key in any dictionary'
    );
  });

  it('returns the English text in English', () => {
    setLanguage('en');
    expect(t('Display')).toBe('Display');
  });

  it('fills placeholders in either language', () => {
    setLanguage('pt-BR');
    expect(t('Enable {label}', { label: 'Radar' })).toBe('Ativar Radar');
    setLanguage('en');
    expect(t('Enable {label}', { label: 'Radar' })).toBe('Enable Radar');
  });

  it('passes an absent text through', () => {
    expect(t(undefined)).toBeUndefined();
    expect(t(null)).toBeNull();
  });

  it('ignores an unsupported language', () => {
    setLanguage('en');
    setLanguage('xx' as never);
    expect(getLanguage()).toBe('pt-BR');
  });
});

describe('pt-BR dictionary', () => {
  it('keeps every placeholder of the English text', () => {
    const broken = Object.entries(ptBR).filter(
      ([english, portuguese]) =>
        placeholders(english) !== placeholders(portuguese)
    );
    expect(broken).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(ptBR).filter(([, value]) => !value.trim())).toEqual(
      []
    );
  });

  it('leaves proper names and racing abbreviations untranslated', () => {
    for (const term of ['iRating', 'SR', 'DNF', 'PIT', 'iRacing', 'Gantry']) {
      expect(ptBR).not.toHaveProperty(term);
    }
    expect(ptBR['Driver name format']).toBeDefined();
    expect(ptBR["Driver's iRating at the start of the event."]).toContain(
      'iRating'
    );
  });

  it('names each language in its own language', () => {
    for (const { label } of SUPPORTED_LANGUAGES) {
      expect(ptBR).not.toHaveProperty(label);
    }
  });
});

describe('I18nProvider', () => {
  afterEach(() => setLanguage('en'));

  const Label = () => <span>{t('Options')}</span>;

  it('re-renders its children when the language changes', () => {
    const { rerender } = render(
      <I18nProvider language="pt-BR">
        <Label />
      </I18nProvider>
    );
    expect(screen.getByText('Opções')).toBeInTheDocument();

    act(() => {
      rerender(
        <I18nProvider language="en">
          <Label />
        </I18nProvider>
      );
    });
    expect(screen.getByText('Options')).toBeInTheDocument();
  });

  it('uses Portuguese when no language is set', () => {
    render(
      <I18nProvider>
        <Label />
      </I18nProvider>
    );
    expect(screen.getByText('Opções')).toBeInTheDocument();
  });
});
