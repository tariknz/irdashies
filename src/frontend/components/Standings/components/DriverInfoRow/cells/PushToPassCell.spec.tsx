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
        'inset-ring-emerald-300'
      );
    }
  );

  it.each([
    ['active', 'bg-emerald-300'],
    ['cooldown', 'bg-sky-950'],
  ] as const)('preserves %s status with a large count', (status, color) => {
    renderCell({ status, count: 1000 });
    const badge = screen.getByText('999+ s').parentElement;
    expect(badge).toHaveClass(color);
    expect(badge).not.toHaveClass('animate-pulse');
  });

  it.each([
    ['inactive', 20, 'inset-ring-amber-300', 'ready, low reserve'],
    ['inactive', 21, 'inset-ring-emerald-300', 'ready'],
    ['active', 20, 'bg-amber-300', 'active, low reserve'],
    ['active', 21, 'bg-emerald-300', 'active'],
    ['cooldown', 20, 'bg-sky-950', 'on cooldown'],
  ] as const)(
    'styles %s with %i seconds remaining',
    (status, count, color, label) => {
      renderCell({ status, count });
      expect(screen.getByText(`${count} s`).parentElement).toHaveClass(color);
      expect(
        screen.getByRole('cell', {
          name: `Push to Pass ${label}, ${count} seconds remaining`,
        })
      ).toBeInTheDocument();
    }
  );

  it('keeps an exhausted indicator at zero', () => {
    renderCell({ status: 'exhausted', count: 0 });
    expect(screen.getByText('0 s')).toBeInTheDocument();
    expect(screen.getByText('0 s').parentElement).toHaveClass('bg-slate-900');
    expect(
      screen.getByRole('cell', {
        name: 'Push to Pass exhausted, 0 seconds remaining',
      })
    ).toBeInTheDocument();
  });

  it('leaves unsupported cars empty', () => {
    renderCell();
    expect(screen.getByRole('cell')).toBeEmptyDOMElement();
  });
});
