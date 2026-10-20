import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { TrackLimitsItem } from './TrackLimitsItem';

const snapshot = vi.hoisted(() => ({
  current: {} as Partial<SessionBarSnapshot>,
}));

vi.mock('@irdashies/context', () => ({
  useSessionBarSnapshot: () => snapshot.current,
}));

const item = (state: Partial<SessionBarSnapshot>) => {
  snapshot.current = state;
  return render(<TrackLimitsItem settings={undefined} standalone={false} />)
    .container;
};

describe('TrackLimitsItem', () => {
  it('shows the points against the ceiling, as the sim does', () => {
    // 0.25 says nothing on its own -- the drive-through is at three.
    expect(
      item({ trackLimitsPoints: 0.25, trackLimitsPointsMax: 3 }).textContent
    ).toBe('0.25 / 3.00');
  });

  it('shows a dash for an unstated ceiling, not a zero', () => {
    // "/0" would read as a penalty served at nothing.
    expect(item({ trackLimitsPoints: 0.5 }).textContent).toBe('0.50 / –');
  });

  it('renders nothing on a sim with no such system', () => {
    // Not 0.00/-: the player is not clean under rules that do not exist.
    expect(item({}).textContent).toBe('');
    expect(item({ trackLimitsPointsMax: 3 }).textContent).toBe('');
  });

  it('shows a clean player as 0.00 rather than hiding', () => {
    expect(
      item({ trackLimitsPoints: 0, trackLimitsPointsMax: 3 }).textContent
    ).toBe('0.00 / 3.00');
  });

  it('escalates as the ceiling approaches', () => {
    const tone = (points: number) => {
      const spans = item({
        trackLimitsPoints: points,
        trackLimitsPointsMax: 3,
      }).querySelectorAll('span');
      return spans[0]?.className ?? '';
    };
    expect(tone(0.25)).toBe('');
    expect(tone(2)).toContain('text-amber-300');
    expect(tone(3)).toContain('text-red-400');
  });
});
