import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TrackLimitsCell } from './TrackLimitsCell';

const cell = (props: Parameters<typeof TrackLimitsCell>[0]) =>
  render(
    <table>
      <tbody>
        <tr>
          <TrackLimitsCell {...props} />
        </tr>
      </tbody>
    </table>
  ).container.querySelector('[data-column="trackLimits"]') as HTMLElement;

describe('TrackLimitsCell', () => {
  it('shows two decimals, as the sim does', () => {
    // The sim counts quarter-points, so rounding to an integer would show a
    // car one infringement from a drive-through as clean.
    expect(cell({ points: 0.25, max: 3 }).textContent).toBe('0.25');
    expect(cell({ points: 2.75, max: 3 }).textContent).toBe('2.75');
  });

  it('shows a clean car as 0.00, not as blank', () => {
    expect(cell({ points: 0, max: 3 }).textContent).toBe('0.00');
  });

  it('renders nothing for a car with no reading', () => {
    // Blank, not 0.00: the sim has not said this car is clean.
    expect(cell({ points: undefined, max: 3 }).textContent).toBe('');
  });

  it('escalates as the ceiling approaches', () => {
    const tone = (points: number) =>
      cell({ points, max: 3 }).querySelector('span')?.className ?? '';
    expect(tone(0)).toContain('text-white/50');
    expect(tone(0.25)).toBe('');
    expect(tone(2)).toContain('text-amber-300');
    expect(tone(3)).toContain('text-red-400');
  });

  it('still shows the number when the ceiling is unknown', () => {
    const rendered = cell({ points: 1.5, max: undefined });
    expect(rendered.textContent).toBe('1.50');
    expect(rendered.querySelector('span')?.className).toBe('');
  });
});
