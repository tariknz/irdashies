import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { P2PDisplayState } from '@irdashies/context';
import { PushToPassCell } from './PushToPassCell';

const renderCell = (state?: P2PDisplayState) =>
  render(
    <table>
      <tbody>
        <tr>
          <PushToPassCell state={state} />
        </tr>
      </tbody>
    </table>
  );

describe('PushToPassCell', () => {
  it.each([65, 201, 999])('preserves the remaining count of %i', (count) => {
    renderCell({ status: 'inactive', count });
    expect(screen.getByText(`${count} s`)).toBeInTheDocument();
  });

  it.each([1000, 100000])(
    'shows a visible overflow count for %i without requiring hover',
    (count) => {
      renderCell({ status: 'inactive', count });
      expect(screen.getByText('999+ s')).toBeInTheDocument();
      expect(screen.getByText('999+ s').parentElement).toHaveClass(
        'bg-lime-200'
      );
    }
  );

  it.each([
    ['active', 'bg-lime-500'],
    ['cooldown', 'bg-sky-500'],
  ] as const)('preserves %s status with a large count', (status, color) => {
    renderCell({ status, count: 1000 });
    expect(screen.getByText('999+ s').parentElement).toHaveClass(
      color,
      'animate-pulse'
    );
  });

  it('keeps an exhausted indicator at zero', () => {
    renderCell({ status: 'exhausted', count: 0 });
    expect(screen.getByText('0 s')).toBeInTheDocument();
    expect(screen.getByText('0 s').parentElement).toHaveClass('bg-red-500/80');
  });

  it('leaves unsupported cars empty', () => {
    renderCell();
    expect(screen.getByRole('cell')).toBeEmptyDOMElement();
  });
});
