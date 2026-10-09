import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CarManufacturerCell } from './CarManufacturerCell';

const renderInTable = (component: React.ReactElement) => {
  return render(
    <table>
      <tbody>
        <tr>{component}</tr>
      </tbody>
    </table>
  );
};

describe('CarManufacturerCell', () => {
  it('renders an empty cell when no car id is provided', () => {
    const { container } = renderInTable(<CarManufacturerCell />);
    const td = container.querySelector('td[data-column="carManufacturer"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
  });

  // Car id 0 means "no manufacturer we can draw" (LMU brands without a sprite).
  it('renders an empty cell for an unresolved car id', () => {
    const { container } = renderInTable(<CarManufacturerCell carId={0} />);
    expect(container.querySelector('td')?.textContent).toBe('');
  });

  it('renders a logo for a known car id', () => {
    const { container } = renderInTable(<CarManufacturerCell carId={165} />);
    expect(container.querySelector('span')).toBeTruthy();
  });
});
