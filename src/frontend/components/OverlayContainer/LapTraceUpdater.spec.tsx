import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@irdashies/context', () => ({
  useLapTraceRecorder: vi.fn(),
  useWidgetsForThisDisplay: vi.fn(() => []),
}));

import {
  useLapTraceRecorder,
  useWidgetsForThisDisplay,
} from '@irdashies/context';
import { LapTraceUpdater } from './LapTraceUpdater';

const layout = { x: 0, y: 0, width: 100, height: 100 };

const mockWidgets = (widgets: unknown[]) =>
  vi
    .mocked(useWidgetsForThisDisplay)
    .mockReturnValue(widgets as ReturnType<typeof useWidgetsForThisDisplay>);

/**
 * The recorder is the single entry point for the lap trace feature's telemetry
 * subscription, its read on initialize, and its write when a lap is promoted.
 * If it does not run, the widget costs nothing at all.
 */
describe('LapTraceUpdater', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWidgets([]);
  });

  it('does not run the recorder when the widget is absent', () => {
    render(<LapTraceUpdater />);

    expect(useLapTraceRecorder).not.toHaveBeenCalled();
  });

  it('does not run the recorder when the widget is on another display', () => {
    // The hook already filters by display; a recorder per window would have
    // every window writing the same lap to disk.
    mockWidgets([]);

    render(<LapTraceUpdater />);

    expect(useLapTraceRecorder).not.toHaveBeenCalled();
  });

  it('runs the recorder for the configured reference source', () => {
    mockWidgets([
      {
        id: 'laptrace',
        enabled: true,
        layout,
        config: { referenceSource: 'garage61' },
      },
    ]);

    render(<LapTraceUpdater />);

    expect(useLapTraceRecorder).toHaveBeenCalledTimes(1);
    expect(useLapTraceRecorder).toHaveBeenCalledWith('garage61');
  });

  it('falls back to the best lap when no reference source is configured', () => {
    mockWidgets([{ id: 'laptrace', enabled: true, layout, config: {} }]);

    render(<LapTraceUpdater />);

    expect(useLapTraceRecorder).toHaveBeenCalledWith('best');
  });

  it('renders nothing at all', () => {
    mockWidgets([{ id: 'laptrace', enabled: true, layout, config: {} }]);

    // It is mounted outside the hide wrapper, so anything it drew would stay
    // on screen through Alt+H.
    const { container } = render(<LapTraceUpdater />);

    expect(container).toBeEmptyDOMElement();
  });
});
