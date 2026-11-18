import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoricalStorageSection } from './HistoricalStorageSection';
import { useFuelStore } from '../../../FuelCalculator/FuelStore';
import { SettingProps } from '../../components/SettingProp';
import { getWidgetDefaultConfig } from '@irdashies/types';

vi.mock('@irdashies/utils/logger', () => ({ default: { error: vi.fn() } }));
const setup = () => {
  const clear = vi.fn();
  vi.stubGlobal('fuelCalculatorBridge', { clearAllHistory: clear });
  const memory = vi.spyOn(useFuelStore.getState(), 'clearAllData');
  render(
    <SettingProps
      widget="fuel"
      config={getWidgetDefaultConfig('fuel')}
      onChange={vi.fn()}
    >
      <HistoricalStorageSection />
    </SettingProps>
  );
  return { clear, memory };
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('fuel history removal', () => {
  it('requires confirmation, clears memory only after success, and reports completion locally', async () => {
    const { clear, memory } = setup();
    clear.mockResolvedValue(undefined);
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear All History' })
    );
    expect(clear).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clear).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear All History' })
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Clear All History',
      })
    );
    await waitFor(() => expect(memory).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent(
      'Fuel history cleared successfully'
    );
  });
  it('preserves memory when the bridge rejects', async () => {
    const { clear, memory } = setup();
    clear.mockRejectedValue(new Error('storage unavailable'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear All History' })
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Clear All History',
      })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to clear fuel history'
    );
    expect(memory).not.toHaveBeenCalled();
  });
});
