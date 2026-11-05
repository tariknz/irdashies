import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSelect } from './LanguageSelect';
import { LANGUAGE_STORAGE_KEY } from './language';

describe('LanguageSelect', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders the heading and a select with both languages', () => {
    render(<LanguageSelect reload={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Language' })
    ).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('translate', 'no');
    expect(select).toHaveValue('ru');
    expect(screen.getByRole('option', { name: 'Русский' })).toHaveValue('ru');
    expect(screen.getByRole('option', { name: 'English' })).toHaveValue('en');
  });

  it('reflects the stored language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    render(<LanguageSelect reload={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('en');
  });

  it('stores the choice and reloads once on change', async () => {
    const reload = vi.fn();
    render(<LanguageSelect reload={reload} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the current language is selected', async () => {
    const reload = vi.fn();
    render(<LanguageSelect reload={reload} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ru');
    expect(reload).not.toHaveBeenCalled();
  });
});
