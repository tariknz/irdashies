import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IratingChangeCell } from './IratingChangeCell';

const renderCell = (value?: number) =>
  render(
    <table>
      <tbody>
        <tr>
          <IratingChangeCell iratingChangeValue={value} />
        </tr>
      </tbody>
    </table>
  );

describe('IratingChangeCell', () => {
  it('starts each change close to the column before it', () => {
    const { container } = renderCell(-107);
    const cell = container.querySelector('td[data-column="iratingChange"]');
    // Centred in a column as wide as its widest change, a usual two-digit
    // value sat behind a gap; jsdom does no layout, so the classes are what
    // can be checked.
    expect(cell?.classList).toContain('pl-1');
    expect(cell?.classList).not.toContain('text-center');
    expect(screen.getByText('107').classList).toContain('justify-start');
  });
});
