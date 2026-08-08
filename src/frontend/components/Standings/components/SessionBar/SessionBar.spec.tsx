import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeneralSettings, useSessionBarSnapshot } from '@irdashies/context';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { SessionBar } from './SessionBar';
import type { SessionBarConfig } from '@irdashies/types';

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

describe('SessionBar', () => {
  beforeEach(() => {
    vi.mocked(useGeneralSettings).mockReturnValue({
      compactMode: 'normal',
    } as never);
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      sessionName: 'Race',
    } as never);
    vi.mocked(useCurrentTime).mockReturnValue('1:23 PM');
  });

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
