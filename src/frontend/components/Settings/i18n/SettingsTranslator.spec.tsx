import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardProvider } from '@irdashies/context';
import { defaultDashboard, type DashboardBridge } from '@irdashies/types';
import { WindSettings } from '../sections/WindSettings';
import { SettingsTranslator } from './SettingsTranslator';
import { ruTranslator } from './dictionary';
import type { Translator } from './domTranslator';

const testTranslator: Translator = {
  translateText: (text) => (text.trim() === 'Hello' ? 'Привет' : undefined),
};

// .storybook is outside the vitest alias scope, so mockDashboardBridge cannot be
// imported here; this covers what DashboardProvider and a settings page call.
const mockDashboardBridge = {
  dashboardUpdated: (callback: (d: typeof defaultDashboard) => void) => {
    callback(defaultDashboard);
    return () => undefined;
  },
  reloadDashboard: () => undefined,
  saveDashboard: () => undefined,
  listProfiles: async () => [],
  getCurrentProfile: async () => null,
  onEditModeToggled: () => () => undefined,
  stop: () => undefined,
} as unknown as DashboardBridge;

const flush = () => act(() => Promise.resolve());

describe('SettingsTranslator', () => {
  let alertSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();
    confirmSpy = vi.fn(() => true);
    window.alert = alertSpy as unknown as typeof window.alert;
    window.confirm = confirmSpy as unknown as typeof window.confirm;
  });

  afterEach(() => {
    document.documentElement.lang = '';
  });

  it('translates the document and sets lang for ru', async () => {
    const { findByText } = render(
      <>
        <SettingsTranslator language="ru" translator={testTranslator} />
        <p>Hello</p>
      </>
    );
    await flush();
    expect(await findByText('Привет')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ru');
  });

  it('wraps alert and confirm with translated messages and restores them', async () => {
    const { unmount } = render(
      <SettingsTranslator language="ru" translator={testTranslator} />
    );
    await flush();
    window.alert('Hello');
    expect(alertSpy).toHaveBeenCalledWith('Привет');
    expect(window.confirm('Hello')).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith('Привет');
    window.alert('Untranslated');
    expect(alertSpy).toHaveBeenLastCalledWith('Untranslated');
    unmount();
    expect(window.alert).toBe(alertSpy);
    expect(window.confirm).toBe(confirmSpy);
  });

  it('does nothing for en except setting lang', async () => {
    const { getByText } = render(
      <>
        <SettingsTranslator language="en" translator={testTranslator} />
        <p>Hello</p>
      </>
    );
    await flush();
    expect(getByText('Hello')).toBeInTheDocument();
    expect(window.alert).toBe(alertSpy);
    expect(window.confirm).toBe(confirmSpy);
    expect(document.documentElement.lang).toBe('en');
  });

  it('translates a real settings page (WindSettings)', async () => {
    const { findByText } = render(
      <DashboardProvider bridge={mockDashboardBridge}>
        <SettingsTranslator language="ru" translator={ruTranslator} />
        <WindSettings />
      </DashboardProvider>
    );
    await flush();
    expect(await findByText('Показывать только на трассе')).toBeInTheDocument();
  });
});
