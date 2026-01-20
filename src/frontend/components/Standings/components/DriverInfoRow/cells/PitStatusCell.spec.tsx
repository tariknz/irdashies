import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PitStatusCell } from './PitStatusCell';

const renderInTable = (component: React.ReactElement) => {
  return render(
    <table>
      <tbody>
        <tr>{component}</tr>
      </tbody>
    </table>
  );
};

describe('PitStatusCell', () => {
  it('renders empty cell with default width when no props are provided', () => {
    const { container } = renderInTable(<PitStatusCell />);

    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.className).toContain('w-[4.5rem]');
    expect(td?.textContent).toBe('');
  });

  it('renders empty cell when hidden', () => {
    const { container } = renderInTable(
      <PitStatusCell
        hidden={true}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
  });

  it('uses a wider width when showPitTime is enabled', () => {
    const { container } = renderInTable(
      <PitStatusCell
        showPitTime={true}
      />
    );

    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.className).toContain('w-[7rem]');
  });

  it('shows OUT status when conditions are met', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={1}
      />
    );

    expect(container.textContent).toContain('OUT');
  });

  it('does not show OUT when car is off track', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={-1}
      />
    );

    expect(container.textContent).not.toContain('OUT');
  });
});
