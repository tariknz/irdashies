import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeartRate } from './HeartRate';
import { HeartRateEmbed } from './components/HeartRateEmbed';

const mode = vi.hoisted(() => ({ isDemoMode: true }));
vi.mock('@irdashies/context', () => ({ useDashboard: () => mode }));
vi.mock('./hooks/useHeartRateSettings', () => ({
  useHeartRateSettings: () => ({
    enabled: true,
    config: { deviceId: 'configured-session', widgetUrl: 'custom-widget' },
  }),
}));
vi.mock('./components/HeartRateEmbed', () => ({
  HeartRateEmbed: vi.fn(() => <div>Live embed</div>),
}));

afterEach(() => vi.useRealTimers());

describe('Heart Rate demo', () => {
  it('never loads a configured external embed in demo mode and restores it when live', () => {
    vi.useFakeTimers();
    mode.isDemoMode = true;
    const { rerender, unmount } = render(<HeartRate />);
    expect(screen.getByText('126')).toBeInTheDocument();
    expect(HeartRateEmbed).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('128')).toBeInTheDocument();
    mode.isDemoMode = false;
    rerender(<HeartRate />);
    expect(screen.getByText('Live embed')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});
