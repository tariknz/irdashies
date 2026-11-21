import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LapTimeLogConfig } from '@irdashies/types';

const useLapTimeLog = vi.fn();

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ isDemoMode: false }),
  useDrivingState: () => ({ isDriving: true }),
  useFocusCarIdx: () => 0,
  useSessionVisibility: () => true,
  useGeneralSettings: () => undefined,
  useDemoFrame: () => null,
}));

vi.mock('./hooks/useLapTimeLog', () => ({
  useLapTimeLog: (embedded?: boolean) => useLapTimeLog(embedded),
}));

import { LapTimeLog } from './LapTimeLog';

const settings = (
  history: Partial<LapTimeLogConfig['history']>
): LapTimeLogConfig =>
  ({
    background: { opacity: 80 },
    foreground: { opacity: 70 },
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: false,
    showPredictedLap: false,
    showLastLap: false,
    showBestLap: false,
    showAllTimeLap: false,
    delta: { enabled: false, method: 'bestlap' },
    history: { enabled: true, count: 10, ...history },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    showOnlyWhenOnTrack: false,
  }) as LapTimeLogConfig;

const history = Array.from({ length: 30 }, (_, i) => ({
  lap: i + 1,
  time: 90 + i / 10,
  delta: 0,
  dirty: false,
  pitted: false,
  caution: false,
}));

const lapRows = () => screen.queryAllByText(/^LAP \d+$/);

describe('LapTimeLog in the Gantry dock', () => {
  beforeEach(() => {
    useLapTimeLog.mockReset();
  });

  it('shows the 20 most recent laps whatever the overlay is set to', () => {
    useLapTimeLog.mockReturnValue({
      settings: settings({ count: 5, enabled: false }),
      history,
    });
    render(<LapTimeLog embedded />);

    expect(useLapTimeLog).toHaveBeenCalledWith(true);
    expect(lapRows()).toHaveLength(20);
    expect(lapRows()[0]).toHaveTextContent('LAP 30');
    expect(lapRows()[19]).toHaveTextContent('LAP 11');
  });

  it('scrolls its own content when docked, and not on the overlay', () => {
    useLapTimeLog.mockReturnValue({ settings: settings({}), history });
    const { container, unmount } = render(<LapTimeLog embedded />);
    expect(container.firstElementChild).toHaveClass(
      'h-full',
      'overflow-y-auto'
    );
    unmount();

    const overlay = render(<LapTimeLog />);
    expect(overlay.container.firstElementChild).not.toHaveClass(
      'overflow-y-auto'
    );
  });

  it('leaves the overlay showing its own number of laps', () => {
    useLapTimeLog.mockReturnValue({
      settings: settings({ count: 5 }),
      history,
    });
    render(<LapTimeLog />);

    expect(useLapTimeLog).toHaveBeenCalledWith(false);
    expect(lapRows()).toHaveLength(5);
  });

  it('still hides pitted laps when docked, as the overlay is set to', () => {
    useLapTimeLog.mockReturnValue({
      settings: settings({ hidePittedLaps: true }),
      history: history.map((entry) => ({
        ...entry,
        pitted: entry.lap === 30,
      })),
    });
    render(<LapTimeLog embedded />);

    expect(lapRows()).toHaveLength(20);
    expect(lapRows()[0]).toHaveTextContent('LAP 29');
  });
});
