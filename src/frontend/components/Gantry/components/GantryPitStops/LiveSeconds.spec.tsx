import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSeconds, PitTimersPaused } from './LiveSeconds';

let clock = 0;

beforeEach(() => {
  clock = 1000;
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) =>
  act(() => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  });

describe('LiveSeconds', () => {
  it('keeps counting a stop in progress', () => {
    render(<LiveSeconds seconds={10} running since={1000} />);
    advance(3000);
    expect(screen.getByText('13.0s')).toBeTruthy();
  });

  it('holds the last value while timers are paused', () => {
    render(
      <PitTimersPaused value>
        <LiveSeconds seconds={10} running since={1000} />
      </PitTimersPaused>
    );
    advance(3000);
    expect(screen.getByText('10.0s')).toBeTruthy();
  });
});
