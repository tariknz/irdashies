import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IratingChangeCell } from './IratingChangeCell';
import { DriverInfoRow } from '../DriverInfoRow';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: undefined }),
}));

const renderCell = (value?: number, compactMode?: string) =>
  render(
    <table>
      <tbody>
        <tr>
          <IratingChangeCell
            iratingChangeValue={value}
            compactMode={compactMode}
          />
        </tr>
      </tbody>
    </table>
  );

const cell = (container: HTMLElement) =>
  container.querySelector('td[data-column="iratingChange"]');

describe('IratingChangeCell', () => {
  it('starts each change at the column padding rather than centring it', () => {
    const { container } = renderCell(-107);
    // Centred in a column as wide as its widest change, a usual two-digit
    // value sat behind a gap; jsdom does no layout, so the classes are what
    // can be checked.
    expect(cell(container)?.classList).not.toContain('text-center');
    expect(screen.getByText('107').classList).toContain('justify-start');
  });

  it.each([
    [undefined, ['px-2']],
    ['off', ['px-2']],
    ['compact', ['px-1']],
    ['ultra', []],
  ])('pads like the other columns in compact mode %s', (mode, expected) => {
    const { container } = renderCell(42, mode);
    const padding = [...(cell(container)?.classList ?? [])].filter((name) =>
      /^p[xlr]-/.test(name)
    );
    expect(padding).toEqual(expected);
  });

  it('gets the compact mode from its row', () => {
    const { container } = render(
      <table>
        <tbody>
          <DriverInfoRow
            {...({
              carIdx: 1,
              classColor: 0xff0000,
              name: 'A Driver',
              isPlayer: false,
              hasFastestTime: false,
              isMultiClass: false,
              iratingChangeValue: 5,
              compactMode: 'compact',
              config: { iratingChange: { enabled: true } },
              displayOrder: ['iratingChange'],
            } as unknown as Parameters<typeof DriverInfoRow>[0])}
          />
        </tbody>
      </table>
    );
    expect(cell(container)?.classList).toContain('px-1');
  });
});
