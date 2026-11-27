import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNDAMAGED, type DamageSnapshot } from '../logic';
import { DamageDisplay } from './DamageDisplay';

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
  options: { showStats?: boolean; showIntegrity?: boolean } = {}
) =>
  render(
    <DamageDisplay
      data={data}
      opacity={80}
      showIntegrity={options.showIntegrity ?? true}
      showStats={options.showStats ?? false}
    />
  );

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
});
