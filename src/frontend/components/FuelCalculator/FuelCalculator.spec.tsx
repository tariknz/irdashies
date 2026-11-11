import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FuelCalculator } from './FuelCalculator';
import { FuelCalculatorDisplay } from './FuelCalculatorDisplay';
import { useFuelCalculation } from './useFuelCalculation';
import { demoFuelData } from './demoData';

const mode = vi.hoisted(() => ({ isDemoMode: true }));
vi.mock('@irdashies/context', () => ({ useDashboard: () => mode }));
vi.mock('./useFuelCalculation', () => ({
  useFuelCalculation: vi.fn(() => null),
}));
vi.mock('./FuelCalculatorDisplay', () => ({
  FuelCalculatorDisplay: vi.fn(() => null),
}));

describe('Fuel Calculator demo', () => {
  it('shares demo data without mounting the live calculation or persistence, then restores live', () => {
    mode.isDemoMode = true;
    const { rerender, unmount } = render(<FuelCalculator />);
    expect(vi.mocked(FuelCalculatorDisplay).mock.lastCall?.[0].fuelData).toBe(
      demoFuelData
    );
    expect(useFuelCalculation).not.toHaveBeenCalled();
    mode.isDemoMode = false;
    rerender(<FuelCalculator />);
    expect(
      vi.mocked(FuelCalculatorDisplay).mock.lastCall?.[0].fuelData
    ).toBeNull();
    expect(useFuelCalculation).toHaveBeenCalled();
    unmount();
  });
});
