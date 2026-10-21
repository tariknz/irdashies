import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamNameCell } from './TeamNameCell';

describe('TeamNameCell', () => {
  it('shows a formatted driver name below the team when configured', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TeamNameCell
              teamName="Apex Racing"
              driverName="Alice B Smith"
              nameFormat="n.-surname"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = container.querySelector('[data-column="teamName"]');
    expect(cell?.querySelector('.text-white')?.textContent).toBe('Apex Racing');
    expect(cell?.querySelector('.text-slate-400')?.textContent).toBe(
      'A. Smith'
    );
  });
});
