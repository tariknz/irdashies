import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getWidgetDefaultConfig,
  type FuelWidgetSettings,
} from '@irdashies/types';
import { SettingProps } from '../../components/SettingProp';
import { FuelHistorySection } from './FuelHistorySection';

const config = getWidgetDefaultConfig('fuel');

describe('Fuel history settings', () => {
  it('switches to a table and saves the row count as a number', () => {
    const save = vi.fn();
    const Harness = () => {
      const [current, setCurrent] = useState(config);
      const onChange = (change: Partial<FuelWidgetSettings['config']>) => {
        save(change);
        setCurrent((previous) => ({ ...previous, ...change }));
      };
      return (
        <SettingProps widget="fuel" config={current} onChange={onChange}>
          <FuelHistorySection
            settings={{ enabled: true, config: current }}
            onChange={onChange}
          />
        </SettingProps>
      );
    };
    render(<Harness />);
    expect(screen.queryByText('Laps Shown')).not.toBeInTheDocument();
    expect(screen.getByText('Target Line')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Display' }), {
      target: { value: 'table' },
    });
    expect(save).toHaveBeenLastCalledWith({ fuelHistoryType: 'table' });
    expect(screen.queryByText('Graph Properties')).not.toBeInTheDocument();
    expect(screen.queryByText('Target Line')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '8' },
    });
    expect(save).toHaveBeenLastCalledWith({ fuelHistoryLapCount: 8 });
    expect(screen.getByRole('spinbutton')).toHaveValue(8);
  });
});
