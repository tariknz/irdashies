import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UNDAMAGED, type DamageSnapshot } from '../logic';
import { cornerBadgeText, DamageDisplay, damageZoom } from './DamageDisplay';

const iracingRepair: DamageSnapshot = {
  ...UNDAMAGED,
  dentSeverity: [],
  suspensionDamage: [],
  aeroDamage: undefined,
  repairNeeded: true,
  repairTime: 12.5,
  optRepairTime: 4,
};

const renderDisplay = (
  data: DamageSnapshot,
  options: {
    showStats?: boolean;
    showIntegrity?: boolean;
    showTyreWear?: boolean;
    showCornerPct?: boolean;
  } = {}
) =>
  render(
    <DamageDisplay
      data={data}
      opacity={80}
      showIntegrity={options.showIntegrity ?? true}
      showStats={options.showStats ?? false}
      showTyreWear={options.showTyreWear}
      showCornerPct={options.showCornerPct}
    />
  );

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

describe('DamageDisplay', () => {
  it('shows the integrity bars and repair times when asked', () => {
    renderDisplay(
      { ...UNDAMAGED, aeroDamage: 0.3, repairTime: 12.5, optRepairTime: 4 },
      { showStats: true }
    );

    expect(screen.getByText('Aero')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Susp')).toBeTruthy();
    expect(screen.getByText('Tyre')).toBeTruthy();
    expect(screen.getByText('Repair 12.5s')).toBeTruthy();
    expect(screen.getByText('Opt 4.0s')).toBeTruthy();
  });

  it('hides the bars and repair times when not asked', () => {
    renderDisplay(
      { ...UNDAMAGED, aeroDamage: 0.3, repairTime: 12.5 },
      { showStats: false }
    );

    expect(screen.queryByText('Aero')).toBeNull();
    expect(screen.queryByText('Repair 12.5s')).toBeNull();
  });

  it('says a repair is needed on iRacing, without inventing a body percentage', () => {
    renderDisplay(iracingRepair, { showStats: true });

    expect(screen.getByText('Repair needed')).toBeTruthy();
    expect(screen.queryByText('50%')).toBeNull();
    expect(screen.queryByText('75%')).toBeNull();
  });

  it('labels a side with one heavy dent on the panel-average scale', () => {
    renderDisplay({ ...UNDAMAGED, dentSeverity: [0, 2, 0, 0, 0, 0, 0, 0] });

    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getAllByText(/^\d+%$/).length).toBeGreaterThan(0);
  });

  it('shows the remaining tread in the corner badges when asked', () => {
    renderDisplay(
      { ...UNDAMAGED, tyreWear: [0.92, 0.88, 0.5, 0.75] },
      { showCornerPct: true }
    );

    expect(screen.getByText('LF 92%')).toBeTruthy();
    expect(screen.getByText('RR 75%')).toBeTruthy();
  });

  it('keeps the corner badges to their names by default', () => {
    renderDisplay({ ...UNDAMAGED, tyreWear: [0.92, 0.88, 0.5, 0.75] });

    expect(screen.getByText('LF')).toBeTruthy();
    expect(screen.queryByText('LF 92%')).toBeNull();
  });
});

describe('cornerBadgeText', () => {
  it('adds the tread only when asked and known, and not for a lost wheel', () => {
    expect(cornerBadgeText('LF', 0.92, false, true)).toBe('LF 92%');
    expect(cornerBadgeText('LF', 0.92, false, false)).toBe('LF');
    expect(cornerBadgeText('LF', undefined, false, true)).toBe('LF');
    expect(cornerBadgeText('LF', 0.92, true, true)).toBe('LF');
  });
});

describe('damageZoom', () => {
  it('fits the whole widget to its frame, so resizing scales everything', () => {
    expect(damageZoom({ width: 170, height: 240 }, 240, 1)).toBe(1);
    expect(damageZoom({ width: 340, height: 480 }, 240, 1)).toBe(2);
    expect(damageZoom({ width: 340, height: 240 }, 240, 1)).toBe(1);
  });

  it('applies the widget scale on top', () => {
    expect(damageZoom({ width: 170, height: 240 }, 240, 1.5)).toBe(1.5);
  });

  it('uses the widget scale alone before the frame is measured', () => {
    expect(damageZoom({ width: 0, height: 0 }, 240, 0.8)).toBe(0.8);
  });
});
