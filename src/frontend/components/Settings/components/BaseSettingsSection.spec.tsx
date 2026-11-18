import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { BaseSettingsSection } from './BaseSettingsSection';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  update: vi.fn(),
}));
vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: mocks.update,
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});
beforeEach(() => {
  mocks.update.mockClear();
  mocks.dashboard = {
    widgets: [
      {
        id: 'relative',
        enabled: true,
        layout: { x: 40, y: 90, width: 400, height: 300 },
        config: {
          browserPosition: { x: 20, y: 30 },
          background: { opacity: 80 },
        },
      },
      {
        id: 'wind',
        enabled: false,
        layout: { x: 100, y: 120, width: 200, height: 100 },
        config: {},
      },
    ],
  };
});
function renderSection() {
  return render(
    <main tabIndex={-1}>
      <BaseSettingsSection
        title="Relative"
        description="Relative settings"
        widgetId="relative"
        settings={{ enabled: true, config: {} }}
        onSettingsChange={vi.fn()}
      />
    </main>
  );
}
describe('overlay position reset confirmation', () => {
  it('can be cancelled by keyboard without modifying either position', async () => {
    const user = userEvent.setup();
    renderSection();
    const trigger = screen.getByRole('button', { name: 'Reset Position' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Reset Position' });
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole('button', { name: 'Reset Position' })
    ).toHaveFocus();
    await user.tab();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('resets only the selected overlay and browser-source positions after confirmation', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: 'Reset Position' }));
    expect(mocks.update).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reset Position',
      })
    );
    assert(mocks.dashboard);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      ...mocks.dashboard,
      widgets: [
        {
          ...mocks.dashboard.widgets[0],
          layout: { x: 0, y: 0, width: 400, height: 300 },
          config: { browserPosition: undefined, background: { opacity: 80 } },
        },
        mocks.dashboard.widgets[1],
      ],
    });
  });
});
