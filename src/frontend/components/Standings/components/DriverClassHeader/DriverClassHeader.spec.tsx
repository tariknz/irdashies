import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DriverClassHeader } from './DriverClassHeader';

const renderHeader = (exact = false) =>
  render(
    <table>
      <tbody>
        <DriverClassHeader
          className="GTE"
          classColor={0x00d4ff}
          totalDrivers={12}
          sof={2432}
          estimatedLaps={{ currentLap: 44, total: exact ? 55 : 55.38, exact }}
          isMultiClass
          classHeaderStyle={{ estimatedLaps: { enabled: true, numLaps: 5 } }}
        />
      </tbody>
    </table>
  );

describe('DriverClassHeader estimated laps', () => {
  it('keeps the lap count on one line, however narrow the header', () => {
    renderHeader();
    const laps = screen.getByTestId('class-estimated-laps');
    expect(laps.textContent).toBe('44 / ≈55.38');
    // The text has spaces, so a shrinking flex item wrapped it in a narrow
    // widget; jsdom does no layout, so the classes are what can be checked.
    expect(laps.classList).toContain('whitespace-nowrap');
    expect(laps.classList).toContain('shrink-0');
  });

  it('shows an exact total without the approximation sign', () => {
    renderHeader(true);
    expect(screen.getByTestId('class-estimated-laps').textContent).toBe(
      '44 / 55'
    );
  });
});
