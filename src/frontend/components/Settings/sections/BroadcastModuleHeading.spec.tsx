import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { BroadcastGroupSettings } from './BroadcastGroupSettings';

const currentDashboard = {
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
    onDashboardUpdated: vi.fn(),
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
