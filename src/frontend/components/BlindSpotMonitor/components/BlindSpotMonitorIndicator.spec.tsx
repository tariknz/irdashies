import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import { BlindSpotMonitorIndicator } from './BlindSpotMonitorIndicator';

describe('BlindSpotMonitorIndicator movement lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const props = {
    side: 'left' as const,
    percent: 0,
    state: CarLeftRight.CarLeft,
    visible: true,
    disableTransition: false,
  };
  const moving = (container: HTMLElement) => {
    const indicator = container.querySelector<HTMLElement>(
      '[style*="transform"]'
    );
    if (!indicator) throw new Error('Missing moving indicator');
    return indicator;
  };

  it('shows immediately, then enables smooth transform movement after 33ms', () => {
    const { container, rerender } = render(
      <BlindSpotMonitorIndicator {...props} />
    );
    const indicator = moving(container);
    expect(indicator.style.transition).toBe('none');
    act(() => vi.advanceTimersByTime(32));
    expect(indicator.style.transition).toBe('none');
    act(() => vi.advanceTimersByTime(1));
    expect(indicator.style.transition).toBe('transform 0.04s linear');
    const initialTransform = indicator.style.transform;
    rerender(<BlindSpotMonitorIndicator {...props} percent={0.5} />);
    expect(indicator.style.transform).not.toBe(initialTransform);
    expect(indicator.style.top).toBe('');
    expect(indicator.classList).toContain('top-0');
    expect(indicator.style.transition).toBe('transform 0.04s linear');
  });

  it('cancels motion when hidden and delays interpolation on reappearance', () => {
    const { container, rerender } = render(
      <BlindSpotMonitorIndicator {...props} />
    );
    act(() => vi.advanceTimersByTime(33));
    rerender(
      <BlindSpotMonitorIndicator {...props} visible={false} percent={0.8} />
    );
    expect(moving(container).style.transition).toBe('none');
    expect(container.firstElementChild).toHaveStyle({ display: 'none' });
    rerender(<BlindSpotMonitorIndicator {...props} percent={-0.8} />);
    expect(moving(container).style.transition).toBe('none');
    act(() => vi.advanceTimersByTime(33));
    expect(moving(container).style.transition).toBe('transform 0.04s linear');
  });

  it('honors transition suppression and clears pending work on unmount', () => {
    const { container, rerender, unmount } = render(
      <BlindSpotMonitorIndicator {...props} />
    );
    rerender(<BlindSpotMonitorIndicator {...props} disableTransition />);
    act(() => vi.advanceTimersByTime(100));
    expect(moving(container).style.transition).toBe('none');
    rerender(<BlindSpotMonitorIndicator {...props} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
