import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';
import { IndividualWidgetView } from './IndividualWidgetWindow';

const mocks = vi.hoisted(() => ({
  hidden: new Set<string>(),
  pitLap: vi.fn(),
  push: vi.fn(),
  sector: vi.fn(),
  timing: vi.fn(),
}));
vi.mock('@irdashies/context', () => ({
  useContainerOffset: () => ({ x: -180, y: -80 }),
  useHiddenWidgetIds: () => mocks.hidden,
  usePitLapStoreUpdater: mocks.pitLap,
  usePushToPassStoreUpdater: mocks.push,
  SectorTimingUpdater: () => {
    mocks.sector();
    return null;
  },
  SessionTimingUpdater: (props: unknown) => {
    mocks.timing(props);
    return null;
  },
}));
vi.mock('../WidgetIndex', () => ({
  getWidget: () => (props: { title?: string }) => (
    <div>{props.title ?? 'Widget content'}</div>
  ),
}));

const widget = (type = 'flag'): DashboardWidget => ({
  id: 'instance-2',
  type,
  enabled: true,
  scale: 100,
  layout: { x: 200, y: 100, width: 300, height: 200 },
  config: { title: 'Second instance' },
});

describe('individual widget presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hidden.clear();
  });
  it('renders the assigned instance at window-local coordinates without editor controls', () => {
    const { container } = render(
      <IndividualWidgetView widget={widget()} running />
    );
    expect(screen.getByText('Second instance')).toBeInTheDocument();
    expect(
      container.querySelector('[data-widget-id="instance-2"]')
    ).toHaveStyle({
      left: '20px',
      top: '20px',
      width: '300px',
      height: '200px',
    });
    expect(screen.queryByRole('button')).toBeNull();
    expect(mocks.pitLap).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.sector).not.toHaveBeenCalled();
    expect(mocks.timing).toHaveBeenCalledWith({ soloWidgetType: 'flag' });
  });
  it('honours simulator disconnect and always-visible widgets', () => {
    const { rerender } = render(
      <IndividualWidgetView widget={widget()} running={false} />
    );
    expect(screen.queryByText('Second instance')).toBeNull();
    rerender(
      <IndividualWidgetView
        widget={{ ...widget(), alwaysEnabled: true }}
        running={false}
      />
    );
    expect(screen.getByText('Second instance')).toBeInTheDocument();
  });
  it('honours per-instance hide hotkeys', () => {
    mocks.hidden.add('instance-2');
    render(<IndividualWidgetView widget={widget()} running />);
    expect(screen.queryByText('Second instance')).toBeNull();
  });
  it('mounts table state only for the assigned table configuration', () => {
    render(
      <IndividualWidgetView
        widget={{
          ...widget('relative'),
          config: {
            pushToPass: { enabled: true },
            pitStatus: { enabled: true },
          },
        }}
        running
      />
    );
    expect(mocks.push).toHaveBeenCalledWith(true);
    expect(mocks.pitLap).toHaveBeenCalledWith(true);
  });
});
