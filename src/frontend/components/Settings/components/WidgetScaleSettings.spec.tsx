import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { BaseSettingsSection } from './BaseSettingsSection';
import { WidgetScaleSettings } from './WidgetScaleSettings';

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

const settings = { enabled: true, config: { opacity: 80 } };
const renderSection = (widgetId = 'fuel-2') => (
  <BaseSettingsSection
    title="Fuel"
    description="Fuel settings"
    widgetId={widgetId}
    settings={settings}
    onSettingsChange={() => undefined}
  >
    {(change) => (
      <>
        <WidgetScaleSettings widgetId={widgetId} />
        <button onClick={() => change({ opacity: 40 })}>Change opacity</button>
      </>
    )}
  </BaseSettingsSection>
);

beforeEach(() => {
  mocks.update.mockReset();
  mocks.dashboard = {
    widgets: ['fuel', 'fuel-2'].map((id) => ({
      id,
      type: 'fuel',
      enabled: true,
      config: { opacity: 80 },
      scale: id === 'fuel' ? 90 : 125,
      layout: { x: 20, y: 40, width: 400, height: 200 },
    })),
    generalSettings: { fontSize: 'md' },
  };
});

describe('WidgetScaleSettings in shared settings', () => {
  it('defaults older widgets to 100% without writing a setting', () => {
    if (!mocks.dashboard) throw new Error('Missing test dashboard');
    delete mocks.dashboard.widgets[1].scale;
    render(renderSection());
    expect(screen.getByRole('slider', { name: /Widget Scale/ })).toHaveValue(
      '100'
    );
    expect(
      screen.getByRole('button', { name: 'Reset scale to 100%' })
    ).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('updates only the chosen instance, preserving its config and layout', () => {
    render(renderSection());
    const slider = screen.getByRole('slider', { name: /Widget Scale/ });
    expect(slider).toHaveValue('125');
    expect(slider).toHaveAttribute('min', '50');
    expect(slider).toHaveAttribute('max', '200');
    expect(slider).toHaveAttribute('step', '5');
    fireEvent.change(slider, { target: { value: '150' } });
    expect(mocks.update).toHaveBeenCalledWith({
      ...mocks.dashboard,
      widgets: mocks.dashboard?.widgets.map((w) =>
        w.id === 'fuel-2' ? { ...w, scale: 150 } : w
      ),
    });
  });

  it('keeps scale through other settings edits, enable changes and position reset', () => {
    const { rerender } = render(renderSection());
    fireEvent.change(screen.getByRole('slider', { name: /Widget Scale/ }), {
      target: { value: '150' },
    });
    mocks.dashboard = mocks.update.mock.lastCall?.[0] as DashboardLayout;
    rerender(renderSection());
    fireEvent.click(screen.getByText('Change opacity'));
    expect(mocks.update.mock.lastCall?.[0].widgets[1]).toMatchObject({
      scale: 150,
      config: { opacity: 40 },
    });
    fireEvent.click(screen.getByRole('switch'));
    expect(mocks.update.mock.lastCall?.[0].widgets[1]).toMatchObject({
      scale: 150,
      enabled: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Position' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Reset Position' })[1]
    );
    expect(mocks.update.mock.lastCall?.[0].widgets[1]).toMatchObject({
      scale: 150,
      layout: { x: 0, y: 0, width: 400, height: 200 },
    });
  });

  it('resets only this instance to 100%', () => {
    render(renderSection());
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset scale to 100%' })
    );
    expect(
      mocks.update.mock.lastCall?.[0].widgets.map(
        (w: { scale: number }) => w.scale
      )
    ).toEqual([90, 100]);
  });

  it('reads the next widget instance when the selection changes', () => {
    const { rerender } = render(renderSection());
    rerender(renderSection('fuel'));
    expect(screen.getByRole('slider', { name: /Widget Scale/ })).toHaveValue(
      '90'
    );
  });
});
