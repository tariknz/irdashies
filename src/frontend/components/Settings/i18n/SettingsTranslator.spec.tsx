import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardProvider } from '@irdashies/context';
import {
  DEFAULT_KEYBINDINGS,
  defaultDashboard,
  type DashboardBridge,
} from '@irdashies/types';
import { WindSettings } from '../sections/WindSettings';
import { AboutSettings } from '../sections/AboutSettings';
import { AdvancedSettings } from '../sections/AdvancedSettings';
import { ChromiumFlagsSettings } from '../sections/ChromiumFlagsSettings';
import { DriverTagsSettings } from '../sections/DriverTagsSettings';
import { KeybindingsSettings } from '../sections/KeybindingsSettings';
import { ProfileSettings } from '../sections/ProfileSettings';
import { GeneralSettings } from '../sections/GeneralSettings';
import { SettingsTranslator } from './SettingsTranslator';
import { ruTranslator } from './dictionary';
import { startDomTranslation, type Translator } from './domTranslator';
import { KEEP_AS_IS } from './ru/keepAsIs';

const testTranslator: Translator = {
  translateText: (text) => (text.trim() === 'Hello' ? 'Привет' : undefined),
};

const PROFILE = {
  id: 'default',
  name: 'Default',
  lastModified: '2026-11-05T10:00:00.000Z',
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
  listProfiles: async () => [PROFILE],
  getCurrentProfile: async () => PROFILE,
  onEditModeToggled: () => () => undefined,
  stop: () => undefined,
  getAnalyticsOptOut: async () => false,
  getComponentServerPort: async () => 3000,
  getDriverTagSettings: async () => ({
    groups: [{ id: 'g1', name: 'Rivals', color: 0xff0000 }],
    entries: [{ id: '123', name: 'Max Verstappen', groupId: 'g1' }],
    mapping: {},
    display: { enabled: true, displayStyle: 'badge' },
  }),
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
    Object.assign(window, {
      keybindingsBridge: {
        getKeybindings: async () => DEFAULT_KEYBINDINGS,
        getRegistrationErrors: async () => ({}),
      },
    });
  });

  afterEach(() => {
    document.documentElement.lang = '';
    Reflect.deleteProperty(window, 'keybindingsBridge');
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

  // Data on the pages (profile date, server address, group name, shortcuts).
  const pageData = [
    new Date(PROFILE.lastModified).toLocaleString(),
    'localhost',
    'Rivals',
    // Shortcut recorder buttons show accelerators, e.g. "Alt + H".
    ...Object.values(DEFAULT_KEYBINDINGS)
      .filter(({ accelerator }) => accelerator)
      .map(({ accelerator }) => accelerator.split('+').join(' + ')),
  ];

  it.each([
    ['General', GeneralSettings],
    ['About', AboutSettings],
    ['Advanced', AdvancedSettings],
    ['Chromium flags', ChromiumFlagsSettings],
    ['Profiles', ProfileSettings],
    ['Key Bindings', KeybindingsSettings],
    ['Driver Tags', DriverTagsSettings],
  ])('leaves no English text on the %s page', async (_, Page) => {
    const missing: string[] = [];
    const { container } = render(
      <DashboardProvider bridge={mockDashboardBridge}>
        <Page />
      </DashboardProvider>
    );
    await flush();
    const stop = startDomTranslation(container, ruTranslator, {
      onMissing: (text) => {
        if (!KEEP_AS_IS.has(text) && !pageData.includes(text)) {
          missing.push(text);
        }
      },
    });
    await flush();
    stop();
    expect(missing).toEqual([]);
  });

  it('translates the shortcut recorder buttons on the Key Bindings page', async () => {
    const { container } = render(
      <DashboardProvider bridge={mockDashboardBridge}>
        <KeybindingsSettings />
      </DashboardProvider>
    );
    await flush();
    const stop = startDomTranslation(container, ruTranslator);
    await flush();
    stop();
    const texts = [...container.querySelectorAll('*')].map((el) =>
      el.textContent?.trim()
    );
    expect(texts).not.toContain('Not set');
    expect(texts).toContain('Не задано');
  });

  it('translates text split around inline code on the Chromium flags page', async () => {
    const { container } = render(<ChromiumFlagsSettings />);
    const stop = startDomTranslation(container, ruTranslator);
    await flush();
    stop();
    expect(container.textContent).toContain(
      '(без --). Строки с символом # в начале игнорируются.'
    );
    expect(
      container.querySelector('textarea[rows="6"]')?.getAttribute('placeholder')
    ).toBe(
      '# Один ключ в строке, без "--" в начале\n# Примеры:\n# disable-gpu-vsync\n# force-color-profile=srgb'
    );
  });
});
