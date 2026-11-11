import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedSettings } from './AdvancedSettings';

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  update: vi.fn(),
  exportFile: vi.fn(),
}));
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: [] },
    onDashboardUpdated: mocks.update,
    resetDashboard: mocks.reset,
    bridge: { exportDashboardToFile: mocks.exportFile },
  }),
}));
vi.mock('@irdashies/utils/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('./TelemetryInspectorSettings', () => ({
  TelemetryInspectorSettings: () => <div>Inspector</div>,
}));
vi.mock('./ChromiumFlagsSettings', () => ({
  ChromiumFlagsSettings: () => <div>Chromium</div>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reset.mockResolvedValue({ widgets: [] });
});
describe('Advanced reset and feedback', () => {
  it.each([
    ['Widget configs only', false, 'Reset Configurations'],
    ['Everything to factory defaults', true, 'Reset Everything'],
  ] as const)(
    'confirms %s before preserving its reset scope',
    async (action, scope, confirmText) => {
      render(<AdvancedSettings />);
      const opener = screen.getByRole('button', { name: action });
      await userEvent.click(opener);
      expect(mocks.reset).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(opener).toHaveFocus();
      await userEvent.click(opener);
      await userEvent.click(screen.getByRole('button', { name: confirmText }));
      await waitFor(() => expect(mocks.reset).toHaveBeenCalledWith(scope));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  );
  it('shows invalid JSON locally without saving or exporting it', async () => {
    render(<AdvancedSettings />);
    const input = screen.getByRole('textbox', {
      name: 'Dashboard configuration JSON',
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'invalid');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
    expect(mocks.update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(mocks.exportFile).not.toHaveBeenCalled();
  });
  it('reports a failed reset without marking JSON invalid', async () => {
    mocks.reset.mockRejectedValueOnce(new Error('storage unavailable'));
    render(<AdvancedSettings />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Widget configs only' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset Configurations' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to reset'
    );
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  });
});
