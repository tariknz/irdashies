import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  getWidgetDefaultConfig,
  type DashboardLayout,
} from '@irdashies/types';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { BroadcastGroupSettings } from './BroadcastGroupSettings';
import { BroadcastSettings } from './BroadcastSettings';
import { mockDashboardUpdater } from '../mockDashboardUpdater';

const mockSave = vi.fn();
let currentDashboard: DashboardLayout = {
  widgets: [
    {
      id: 'broadcastticker',
      enabled: true,
      config: {},
      layout: { x: 0, y: 0, width: 100, height: 100 },
    },
  ],
};
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard,
    onDashboardUpdated: mockDashboardUpdater(() => currentDashboard, mockSave),
    bridge: {},
  }),
  useActiveSimulator: () => 'iracing',
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
}));
vi.mock('../components/SettingsPreviewLayout', () => ({
  SettingsPreviewLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="preview-layout">{children}</div>
  ),
}));
vi.mock('./BroadcastPreview', () => ({
  BroadcastPreview: () => null,
}));

describe('broadcast module page heading', () => {
  it('is the module title, with the page keeping one preview', () => {
    render(
      <MemoryRouter>
        <SettingsPreviewContext value="broadcastticker">
          <BroadcastGroupSettings active="broadcastticker" />
        </SettingsPreviewContext>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Broadcast Ticker' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Broadcast' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('preview-layout')).toHaveLength(1);
  });
});

it('keeps newer dashboard changes when the logo finishes loading', async () => {
  const config = getWidgetDefaultConfig('broadcast');
  const widget = {
    id: 'broadcast',
    enabled: true,
    config: { ...config },
    layout: { x: 0, y: 0, width: 100, height: 100 },
  };
  currentDashboard = { widgets: [widget] };
  render(<BroadcastSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Look' }));
  fireEvent.change(screen.getByLabelText('Series logo image'), {
    target: { files: [new File(['logo'], 'logo.png', { type: 'image/png' })] },
  });
  currentDashboard = {
    widgets: [{ ...widget, config: { ...config, title: 'New series title' } }],
  };
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.lastCall?.[0].widgets[0].config).toMatchObject({
    title: 'New series title',
    logo: 'data:image/png;base64,bG9nbw==',
  });
});
