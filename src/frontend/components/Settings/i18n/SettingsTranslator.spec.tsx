import { act, fireEvent, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
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
import { TelemetryInspectorSettings } from '../sections/TelemetryInspectorSettings';
import { GantryDockSettings } from '../sections/GantryDockSettings';
import { LapTraceHelp } from '../sections/LapTraceHelp';
import { withGantryDock } from '../sections/gantryDockEdits';
import { WIDGET_SETTINGS } from '../SettingsLoader';
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

  describe('widget settings pages', () => {
    type Page = ComponentType<{ widgetId?: string; widgetType?: string }>;

    // Data on the pages: widget ids in the instance pickers, the default
    // iRacing camera group and the inspector's default telemetry path.
    const widgetData = ['fuel', 'input', 'Far Chase', 'SessionTime'];

    // Tab bars (TabButton) and the radar's section rail. Not by aria-label:
    // that is translated as soon as the page is.
    const tabButtons = (root: HTMLElement) => [
      ...root.querySelectorAll<HTMLButtonElement>(
        'button.border-b-2, nav button'
      ),
    ];

    // Tabs found per page, so a restyle that breaks the selector fails loudly
    // instead of silently skipping every tab.
    const tabsFound = new Map<string, number>();

    // Minimum tab count per page, from the current behaviour. Pages without
    // tabs are not listed.
    const MIN_TABS: Record<string, number> = {
      battle: 3,
      blindspotmonitor: 3,
      carsystems: 2,
      cornername: 3,
      deltaspeed: 2,
      fastercarsfrombehind: 2,
      flag: 2,
      flatmap: 3,
      fuel: 5,
      gantry: 4,
      infobar: 3,
      input: 3,
      laptimelog: 3,
      laptrace: 6,
      map: 4,
      pitlanehelper: 3,
      radar: 11,
      rejoin: 2,
      relative: 6,
      sectordelta: 2,
      shiftlight: 3,
      slowcarahead: 2,
      standings: 6,
      streamchat: 3,
      tachometer: 3,
      weather: 3,
    };

    const missingOn = async (Page: Page, type: string) => {
      const missing = new Set<string>();
      const { container } = render(
        <MemoryRouter>
          <DashboardProvider bridge={mockDashboardBridge}>
            <Page widgetId={type} widgetType={type} />
          </DashboardProvider>
        </MemoryRouter>
      );
      await flush();
      // The broadcast preview draws the overlays, which stay English.
      container.querySelector('.sticky.w-72')?.setAttribute('translate', 'no');
      const stop = startDomTranslation(container, ruTranslator, {
        onMissing: (text) => {
          if (!KEEP_AS_IS.has(text) && !widgetData.includes(text)) {
            missing.add(text);
          }
        },
      });
      await flush();
      // Open every tab (and radar section) in turn; the translator follows.
      // Buttons are looked up again each time, as a click re-renders the page.
      const count = tabButtons(container).length;
      tabsFound.set(type, count);
      for (let i = 0; i < count; i++) {
        const button = tabButtons(container)[i];
        await act(async () => {
          fireEvent.click(button);
        });
        await flush();
      }
      stop();
      return [...missing];
    };

    beforeEach(() => {
      // Show every radar setting, Dev level included.
      localStorage.setItem('radarSettingsLevel', '2');
      // Live data the previews and Gantry read; none arrives in a test.
      Object.assign(window, {
        channelBridge: { subscribe: () => () => undefined },
        ResizeObserver: class {
          observe() {
            return undefined;
          }
          disconnect() {
            return undefined;
          }
        },
      });
    });

    afterEach(() => {
      localStorage.clear();
      Reflect.deleteProperty(window, 'channelBridge');
    });

    const pages: [string, Page][] = [
      ...Object.entries(WIDGET_SETTINGS),
      // Shown on the Advanced page rather than one of its own.
      ['telemetryinspector', TelemetryInspectorSettings],
    ];

    it.each(pages)(
      'leaves no English text on the %s page',
      async (type, Page) => {
        expect(await missingOn(Page, type)).toEqual([]);
        expect(tabsFound.get(type) ?? 0).toBeGreaterThanOrEqual(
          MIN_TABS[type] ?? 0
        );
      }
    );
  });

  it('translates text split around inline elements on widget pages', async () => {
    const help = render(<LapTraceHelp />);
    let stop = startDomTranslation(help.container, ruTranslator);
    await flush();
    stop();
    expect(help.container.textContent).toContain(
      'Файл .ibt — это телеметрия, которую iRacing записывает'
    );
    expect(help.container.textContent).toContain(
      'Вернитесь сюда, нажмите Импортировать круг Garage 61 на вкладке «График» и выберите файл.'
    );
    help.unmount();

    // A dock with a fuel panel and a track map panel.
    const dashboard = withGantryDock(defaultDashboard, (dock) => ({
      ...dock,
      enabled: true,
      panels: [
        { id: 'p1', type: 'fuel', widgetId: 'fuel' },
        { id: 'p2', type: 'map' },
      ],
    }));
    const missing: string[] = [];
    const dock = render(
      <MemoryRouter>
        <DashboardProvider
          bridge={{
            ...mockDashboardBridge,
            dashboardUpdated: (callback: (d: typeof dashboard) => void) => {
              callback(dashboard);
              return () => undefined;
            },
          }}
        >
          <GantryDockSettings />
        </DashboardProvider>
      </MemoryRouter>
    );
    await flush();
    stop = startDomTranslation(dock.container, ruTranslator, {
      onMissing: (text) => missing.push(text),
    });
    await flush();
    stop();
    expect(missing).toEqual([]);
    const text = dock.container.textContent;
    expect(text).toContain('До 3 панелей.');
    expect(text).toContain('Использует виджет Карта трассы и его настройки.');
    expect(text).toContain('Изменить Карта трассы (настройки)');
    expect(text).toContain('Как на оверлее: Расчёт топлива');
  });
});
