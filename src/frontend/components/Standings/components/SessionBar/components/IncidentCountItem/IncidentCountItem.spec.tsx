import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { IncidentCountItem } from './IncidentCountItem';

const snapshot = vi.hoisted(() => ({
  current: {} as Partial<SessionBarSnapshot>,
}));

vi.mock('@irdashies/context', () => ({
  useSessionBarSnapshot: () => snapshot.current,
}));

const item = (state: Partial<SessionBarSnapshot>) => {
  snapshot.current = state;
  return render(<IncidentCountItem settings={undefined} standalone={false} />)
    .container;
};

describe('IncidentCountItem', () => {
  it('shows track-limit points where the sim counts those', () => {
    // LMU has no incident counter. Showing iRacing's form here meant a
    // permanent "0 / ∞ x" that could never move.
    expect(
      item({
        incidents: 0,
        trackLimitsPoints: 0.25,
        trackLimitsPointsMax: 3,
      }).textContent
    ).toBe('0.25 / 3.00');
  });

  it('escalates as the drive-through approaches', () => {
    const tone = (points: number) =>
      item({
        incidents: 0,
        trackLimitsPoints: points,
        trackLimitsPointsMax: 3,
      }).querySelector('span')?.className ?? '';
    expect(tone(0.25)).toBe('');
    expect(tone(2)).toContain('amber');
    expect(tone(3)).toContain('red');
  });

  it('keeps the incident count where the sim counts incidents', () => {
    // iRacing reports no track-limit points, so the original form stands.
    expect(item({ incidents: 4, incidentLimit: 17 }).textContent).toBe(
      '4 / 17 x'
    );
  });

  it('keeps the unlimited form too', () => {
    expect(item({ incidents: 4 }).textContent).toBe('4 / ∞ x');
  });

  it('prefers points over the count when both are somehow present', () => {
    // A sim reporting both would be new, and the points are the figure that
    // actually governs a penalty.
    expect(
      item({
        incidents: 4,
        incidentLimit: 17,
        trackLimitsPoints: 1.5,
        trackLimitsPointsMax: 3,
      }).textContent
    ).toBe('1.50 / 3.00');
  });

  it('shows a clean LMU driver as 0.00, not as blank', () => {
    expect(
      item({ trackLimitsPoints: 0, trackLimitsPointsMax: 3 }).textContent
    ).toBe('0.00 / 3.00');
  });
});
