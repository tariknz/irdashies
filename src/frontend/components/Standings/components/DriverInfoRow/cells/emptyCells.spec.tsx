import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CountryFlagsCell } from './CountryFlagsCell';
import { CarManufacturerCell } from './CarManufacturerCell';

/**
 * Cells that have nothing to draw draw nothing -- not a digit.
 *
 * Both of these guarded their content with `{value && <Thing/>}`, and both
 * values are ids whose "absent" value is 0. A falsy non-boolean on the left of
 * `&&` is what the expression evaluates to, and React renders a number as
 * text, so the row showed a literal `0` wherever the id was missing. Under LMU
 * that is every AI for the flag -- it has no nationality and no flair id --
 * and every car whose marque did not resolve for the badge.
 *
 * Covered at the cell rather than only at the component because the component
 * was always right: it is the caller's guard that leaked.
 */
const cellContent = (element: React.ReactElement, column: string) =>
  render(
    <table>
      <tbody>
        <tr>{element}</tr>
      </tbody>
    </table>
  ).container.querySelector(`[data-column="${column}"]`) as HTMLElement;

describe('CountryFlagsCell with no country', () => {
  it('renders nothing, not a zero', () => {
    const cell = cellContent(<CountryFlagsCell />, 'countryFlags');
    expect(cell.textContent).toBe('');
    expect(cell.childElementCount).toBe(0);
  });

  it('renders nothing for a flair id of 0', () => {
    // What an LMU driver carries: the flair id is iRacing's and is left at 0.
    const cell = cellContent(<CountryFlagsCell flairId={0} />, 'countryFlags');
    expect(cell.textContent).toBe('');
  });

  it('renders no text for a country flag-icons does not carry', () => {
    const cell = cellContent(
      <CountryFlagsCell flairId={0} countryCode="ZZ" />,
      'countryFlags'
    );
    expect(cell.textContent).toBe('');
  });

  it('still draws a flag it can resolve', () => {
    const cell = cellContent(
      <CountryFlagsCell flairId={0} countryCode="FR" />,
      'countryFlags'
    );
    expect(cell.querySelector('.fi.fi-fr')).not.toBeNull();
  });
});

describe('CarManufacturerCell with no marque', () => {
  it('renders nothing, not a zero', () => {
    const cell = cellContent(<CarManufacturerCell />, 'carManufacturer');
    expect(cell.textContent).toBe('');
  });

  it('renders nothing for a car id of 0', () => {
    // resolveLmuCarId returns 0 when no marque matches the vehicle name, and
    // iRacing's own ids start at 1 -- so 0 is the absence of a car, not one.
    const cell = cellContent(
      <CarManufacturerCell carId={0} />,
      'carManufacturer'
    );
    expect(cell.textContent).toBe('');
    expect(cell.querySelector('span[style]')).toBeNull();
  });

  it('does not reach for the other sim’s sheet at id 0', () => {
    // `isLmu` is false at 0, and the iRacing sheet has an `unknown` cell, so
    // letting 0 through drew a badge from the wrong game rather than none.
    const cell = cellContent(
      <CarManufacturerCell carId={0} />,
      'carManufacturer'
    );
    expect(cell.innerHTML).not.toContain('background-image');
  });
});
