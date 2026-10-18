import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeltaCell } from './DeltaCell';

describe('signed player gap cells', () => {
  it.each([
    [{ value: 12.34, laps: 0 }, '+12.3'],
    [{ value: -12.34, laps: 0 }, '-12.3'],
    [{ value: 0, laps: 0 }, '0.0'],
    [{ value: undefined, laps: 1 }, '+1L'],
    [{ value: undefined, laps: -2 }, '-2L'],
    [{ value: 70, laps: 0 }, '+1:10'],
  ])('formats %j as %s', (gap, text) => {
    render(
      <table>
        <tbody>
          <tr>
            <DeltaCell delta={gap} showSign decimalPlaces={1} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole('cell').textContent).toBe(text);
  });

  it('preserves unsigned leader display by default', () => {
    render(
      <table>
        <tbody>
          <tr>
            <DeltaCell delta={{ value: 12.34, laps: 0 }} decimalPlaces={1} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole('cell').textContent).toBe('12.3');
  });
});
