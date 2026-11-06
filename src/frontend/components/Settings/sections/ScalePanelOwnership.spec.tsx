import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig, type DashboardLayout } from '@irdashies/types';
import { GarageCoverSettings } from './GarageCoverSettings';
import { TelemetryInspectorSettings } from './TelemetryInspectorSettings';

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
      bridge: {},
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

beforeEach(() => {
  mocks.update.mockReset();
  localStorage.clear();
  mocks.dashboard = {
    widgets: [
      {
        id: 'garagecover',
        enabled: false,
        scale: 125,
        layout: { x: 20, y: 40, width: 400, height: 200 },
        config: {
          ...getWidgetDefaultConfig('garagecover'),
          imageFilename: 'fixture-cover.png',
        },
      },
      {
        id: 'telemetryinspector',
        enabled: false,
        scale: 110,
        layout: { x: 30, y: 50, width: 300, height: 100 },
        config: { properties: [{ source: 'telemetry', path: 'Speed' }] },
      },
    ],
    generalSettings: {},
  };
});

const scalePanel = () => {
  const scale = screen.getByRole('group', { name: 'Widget Scale' });
  const panel = scale.closest('section');
  if (!panel) throw new Error('Scale must belong to a configuration panel');
  return { scale, panel };
};

describe('scale ownership in custom configuration panels', () => {
  it('places Garage Cover scale ahead of image selection/removal in one panel', () => {
    render(<GarageCoverSettings />);
    const { scale, panel } = scalePanel();
    const image = within(panel).getByText('Garage Image');
    expect(
      within(panel).getByRole('heading', { name: 'Display' })
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'Remove Image' })
    ).toBeInTheDocument();
    expect(
      scale.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('preserves scale and layout when removing the Garage Cover image', () => {
    render(<GarageCoverSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    const updated: DashboardLayout | undefined =
      mocks.update.mock.lastCall?.[0];
    expect(
      updated?.widgets.find((widget) => widget.id === 'garagecover')
    ).toMatchObject({
      enabled: false,
      scale: 125,
      config: { imageFilename: '' },
      layout: { x: 20, y: 40, width: 400, height: 200 },
    });
  });

  it('keeps Telemetry Inspector scale and watched properties in one panel', () => {
    render(<TelemetryInspectorSettings />);
    const { scale, panel } = scalePanel();
    const property = within(panel).getByText('Speed');
    expect(
      within(panel).getByRole('heading', { name: 'Watched Properties (1)' })
    ).toBeInTheDocument();
    expect(
      scale.compareDocumentPosition(property) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Widget Scale' })).toHaveValue(
      '110'
    );
  });

  it('keeps the embedded inspector configuration below its parent heading', () => {
    render(<TelemetryInspectorSettings embedded />);
    expect(
      screen.getByRole('heading', { name: 'Telemetry Inspector', level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Watched Properties (1)', level: 4 })
    ).toBeInTheDocument();
  });
});
