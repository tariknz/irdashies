import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UNDAMAGED, type DamageSnapshot } from '../logic';
import {
  cornerBadgeText,
  DamageDisplay,
  damageZoom,
  engineWarningText,
  LMU_WARNING_ICONS,
} from './DamageDisplay';
import { EngineWarnings } from '@irdashies/types';
import { SUSP_FILL } from '../logic';

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
    showCornerBadges?: boolean;
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
      showCornerBadges={options.showCornerBadges}
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
    expect(screen.getAllByText('70%')).toHaveLength(2);
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
    expect(screen.getAllByText('67%')).toHaveLength(2);
  });

  it('marks a wheel that lost its pressure as flat, even with tread left', () => {
    const { container } = renderDisplay(
      {
        ...UNDAMAGED,
        tyreWear: [0.92, 0.92, 0.92, 0.92],
        tyrePressure: [0, 180, 180, 180],
      },
      { showTyreWear: false }
    );

    const fills = Array.from(container.querySelectorAll('rect')).map((rect) =>
      rect.getAttribute('fill')
    );
    expect(fills.filter((fill) => fill === SUSP_FILL.detached)).toHaveLength(1);
  });

  it('shows the aero integrity on the car when damage % is on', () => {
    renderDisplay({ ...UNDAMAGED, aeroDamage: 0.3 }, { showStats: false });

    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('keeps the aero label off when damage % is off', () => {
    renderDisplay(
      { ...UNDAMAGED, aeroDamage: 0.3 },
      { showStats: false, showIntegrity: false }
    );

    expect(screen.queryByText('70%')).toBeNull();
  });

  it('names an active engine warning for assistive tech', () => {
    renderDisplay({
      ...UNDAMAGED,
      engineWarnings: EngineWarnings.FuelPressureWarning,
    });

    expect(
      screen.getByRole('img', { name: 'Fuel pressure warning active' })
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Oil' })).toBeTruthy();
  });

  it('shows the remaining tread in the corner badges when asked', () => {
    renderDisplay(
      { ...UNDAMAGED, tyreWear: [0.92, 0.88, 0.5, 0.75] },
      { showCornerPct: true }
    );

    expect(screen.getByText('LF 92%')).toBeTruthy();
    expect(screen.getByText('RR 75%')).toBeTruthy();
  });

  it('hides the corner badges, and their tread, when turned off', () => {
    renderDisplay(
      { ...UNDAMAGED, tyreWear: [0.92, 0.88, 0.5, 0.75] },
      { showCornerBadges: false, showCornerPct: true }
    );

    expect(screen.queryByText('LF')).toBeNull();
    expect(screen.queryByText('LF 92%')).toBeNull();
    expect(screen.queryByText('RR')).toBeNull();
  });

  it('keeps the corner badges to their names by default', () => {
    renderDisplay({ ...UNDAMAGED, tyreWear: [0.92, 0.88, 0.5, 0.75] });

    expect(screen.getByText('LF')).toBeTruthy();
    expect(screen.queryByText('LF 92%')).toBeNull();
  });
});

describe('DamageDisplay warning icons', () => {
  it('shows all four by default', () => {
    render(
      <DamageDisplay
        data={UNDAMAGED}
        opacity={80}
        showIntegrity
        showStats={false}
      />
    );

    expect(
      screen.getAllByRole('img', {
        name: /^(Oil|Fuel pressure|Engine|Water temp)$/,
      })
    ).toHaveLength(4);
  });

  it('shows only the ones the sim can light', () => {
    render(
      <DamageDisplay
        data={{ ...UNDAMAGED, engineWarnings: EngineWarnings.WaterTempWarning }}
        opacity={80}
        showIntegrity
        showStats={false}
        warningIcons={LMU_WARNING_ICONS}
      />
    );

    expect(
      screen.getByRole('img', { name: 'Water temp warning active' })
    ).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Oil' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Fuel pressure' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Engine' })).toBeNull();
  });
});

describe('engineWarningText', () => {
  it('says when a warning is active', () => {
    expect(engineWarningText('Oil', true)).toBe('Oil warning active');
    expect(engineWarningText('Oil', false)).toBe('Oil');
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

  it('shrinks the whole widget below 100% scale', () => {
    expect(damageZoom({ width: 170 / 0.8, height: 240 / 0.8 }, 240, 0.8)).toBe(
      1
    );
  });

  it('stops at the frame above 100% scale, so nothing is cut off', () => {
    const zoom = damageZoom({ width: 170 / 1.5, height: 240 / 1.5 }, 240, 1.5);

    expect(zoom * 1.5).toBeCloseTo(1);
  });

  it('uses the widget scale, capped at 100%, before the frame is measured', () => {
    expect(damageZoom({ width: 0, height: 0 }, 240, 0.8)).toBe(0.8);
    expect(damageZoom({ width: 0, height: 0 }, 240, 1.5)).toBe(1);
  });
});
