import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeneralSettings, useSessionBarSnapshot } from '@irdashies/context';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { SessionBar } from './SessionBar';
import type { SessionBarConfig } from '@irdashies/types';
import { isSessionBarItemEnabled } from './sessionBarItemRegistry';

vi.mock('@irdashies/context', async () => {
  const actual = await vi.importActual('@irdashies/context');
  return {
    ...actual,
    useGeneralSettings: vi.fn(),
    useSessionBarSnapshot: vi.fn(),
  };
});
vi.mock('../../hooks/useCurrentTime');

const baseSettings = {
  enabled: true,
  sessionName: { enabled: true },
  sessionTime: { enabled: false, mode: 'Remaining' },
  sessionLaps: { enabled: false },
  incidentCount: { enabled: false },
  brakeBias: { enabled: false },
  localTime: { enabled: true },
  sessionClockTime: { enabled: false },
  trackWetness: { enabled: false },
  airTemperature: { enabled: false, unit: 'Metric' },
  trackTemperature: { enabled: false, unit: 'Metric' },
  trackName: { enabled: false },
  displayOrder: [] as string[],
} satisfies SessionBarConfig;

beforeEach(() => {
  vi.mocked(useGeneralSettings).mockReturnValue({
    compactMode: 'normal',
  } as never);
  vi.mocked(useSessionBarSnapshot).mockReturnValue({
    sessionName: 'Race',
  } as never);
  vi.mocked(useCurrentTime).mockReturnValue('1:23 PM');
});

describe('SessionBar', () => {
  it('renders enabled items in the given displayOrder', () => {
    const { container } = render(
      <SessionBar
        settings={{
          ...baseSettings,
          displayOrder: ['sessionName', 'localTime'],
        }}
        position="header"
      />
    );

    expect(container.textContent).toBe('Race1:23 PM');
  });

  it('renders nothing when displayOrder has no enabled items', () => {
    const { container } = render(
      <SessionBar
        settings={{ ...baseSettings, displayOrder: [] }}
        position="header"
      />
    );

    const sessionBarEl = container.firstElementChild as HTMLElement;
    expect(sessionBarEl.children).toHaveLength(0);
    expect(container.textContent).toBe('');
  });

  it('applies first/last alignment to the first item that actually renders, skipping items that return null', () => {
    // brakeBias is enabled but its hook returns undefined, so BrakeBiasItem renders
    // null. sessionName should still pick up "first" alignment, and localTime "last".
    const { container } = render(
      <SessionBar
        settings={{
          ...baseSettings,
          brakeBias: { enabled: true },
          displayOrder: ['brakeBias', 'sessionName', 'localTime'],
        }}
        standalone
      />
    );

    const sessionBarEl = container.firstElementChild as HTMLElement;
    const wrapperDivs = sessionBarEl.children;
    expect(wrapperDivs).toHaveLength(2);
    expect(wrapperDivs[0].textContent).toBe('Race');
    expect(wrapperDivs[0].className).toContain('first:text-left');
    expect(wrapperDivs[1].textContent).toBe('1:23 PM');
    expect(wrapperDivs[1].className).toContain('last:text-right');
  });
});

describe('SessionBar untrusted configuration', () => {
  it.each([[42], ['missing'], ['__proto__', 'constructor'], [null], [{}]])(
    'uses header and footer defaults for an invalid-only order %j',
    (...displayOrder) => {
      for (const position of ['header', 'footer'] as const) {
        const { container } = render(
          <SessionBar
            settings={
              { ...baseSettings, displayOrder } as unknown as SessionBarConfig
            }
            position={position}
          />
        );
        expect(container.textContent).toBe(
          position === 'header' ? 'Race1:23 PM' : '1:23 PM'
        );
      }
    }
  );

  it('retains valid keys in the configured order alongside invalid entries', () => {
    const { container } = render(
      <SessionBar
        settings={{
          ...baseSettings,
          displayOrder: ['missing', 'localTime', '__proto__', 'sessionName'],
        }}
      />
    );
    expect(container.textContent).toBe('1:23 PMRace');
  });

  it.each([
    '__proto__',
    '__defineGetter__',
    'constructor',
    'toString',
    'missing',
  ])('ignores the unregistered key %s', (key) => {
    expect(isSessionBarItemEnabled(key, undefined, 'header')).toBe(false);
    const { container } = render(
      <SessionBar
        settings={{ ...baseSettings, displayOrder: [key, 'sessionName'] }}
      />
    );
    expect(container.textContent).toBe('Race');
  });

  it.each([null, 'sessionName', {}, 42])(
    'falls back for malformed order %j',
    (displayOrder) => {
      const { container } = render(
        <SessionBar
          settings={
            { ...baseSettings, displayOrder } as unknown as SessionBarConfig
          }
        />
      );
      expect(container.textContent).toBe('Race1:23 PM');
    }
  );

  it.each(['false', 0, null, {}])(
    'uses the default for a nonboolean enabled value %j',
    (enabled) => {
      const settings = {
        sessionName: { enabled },
      } as unknown as SessionBarConfig;
      expect(isSessionBarItemEnabled('sessionName', settings, 'header')).toBe(
        true
      );
      expect(isSessionBarItemEnabled('sessionName', settings, 'footer')).toBe(
        false
      );
    }
  );
});
