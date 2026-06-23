import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LapCountCell } from './LapCountCell';

const renderInTable = (component: React.ReactElement) => {
  return render(
    <table>
      <tbody>
        <tr>{component}</tr>
      </tbody>
    </table>
  );
};

describe('LapCountCell', () => {
  it('renders an empty cell when no lap is provided', () => {
    const { container } = renderInTable(<LapCountCell />);
    const td = container.querySelector('td[data-column="lapCount"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
  });

  it('renders nothing when lap is 0', () => {
    const { container } = renderInTable(<LapCountCell lap={0} />);
    expect(container.querySelector('td')?.textContent).toBe('');
  });

  it('renders L6 for lap 6', () => {
    const { container } = renderInTable(<LapCountCell lap={6} />);
    expect(container.textContent).toContain('L6');
  });

  it('renders L100 for lap 100 without truncation', () => {
    const { container } = renderInTable(<LapCountCell lap={100} />);
    expect(container.textContent).toContain('L100');
  });

  it('shows border by default', () => {
    const { container } = renderInTable(<LapCountCell lap={6} />);
    expect(container.querySelector('span')?.className).toContain('border-2');
  });

  it('hides border when showBorder is false', () => {
    const { container } = renderInTable(
      <LapCountCell lap={6} showBorder={false} />
    );
    expect(container.querySelector('span')?.className).not.toContain(
      'border-2'
    );
  });

  it('renders L- placeholder when unknown', () => {
    const { container } = renderInTable(<LapCountCell unknown />);
    expect(container.textContent).toContain('L-');
  });

  it('renders L- even when a lap value is also passed', () => {
    const { container } = renderInTable(<LapCountCell lap={22} unknown />);
    expect(container.textContent).toContain('L-');
    expect(container.textContent).not.toContain('L22');
  });
});
