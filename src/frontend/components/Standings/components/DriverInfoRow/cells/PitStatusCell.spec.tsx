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
  it('renders empty cell when no conditions are met - must have explicit empty string to prevent "00"', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        carTrackSurface={1}
        prevCarTrackSurface={1}
        currentSessionType="Qualify"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
    
    // Verify the cell is empty but doesn't contain "00"
    expect(td?.innerHTML).not.toContain('00');
    expect(td?.textContent).toBe('');
  });

  it('renders empty cell when hidden', () => {
    const { container } = renderInTable(
      <PitStatusCell
        hidden={true}
        onPitRoad={true}
        carTrackSurface={2}
        currentSessionType="Race"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
  });

  it('renders DNF when car goes off track in race', () => {
    const { container } = renderInTable(
      <PitStatusCell
        carTrackSurface={-1}
        prevCarTrackSurface={1}
        currentSessionType="Race"
        dnf={true}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.textContent).toBe('DNF');
  });

  it('renders TOW when car is being towed', () => {
    const { container } = renderInTable(
      <PitStatusCell
        carTrackSurface={1}
        prevCarTrackSurface={1}
        lastLap={5}
        currentSessionType="Race"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.textContent).toBe('TOW');
  });

  it('renders OUT when car exits pits', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={1}
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.textContent).toBe('OUT');
  });

  it('renders PIT when car is on pit road', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={true}
        carTrackSurface={2}
        currentSessionType="Race"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.textContent).toBe('PIT');
  });

  it('renders last pit lap when car pitted earlier', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        lastPitLap={2}
        lastLap={5}
        carTrackSurface={1}
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td?.textContent).toBe('L 2');
  });

  it('does not render "00" when all props are undefined', () => {
    const { container } = renderInTable(
      <PitStatusCell />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
    // Ensure innerHTML is empty, not containing "00"
    expect(td?.innerHTML).toBe('');
    expect(td?.innerHTML).not.toContain('00');
  });

  it('does not render "00" when onPitRoad is false and no other conditions match', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        carTrackSurface={1}
        prevCarTrackSurface={1}
        lastLap={0}
        currentSessionType="Qualify"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
  });

  it('does not render "00" when lastLap is 0', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        carTrackSurface={1}
        prevCarTrackSurface={1}
        lastLap={0}
        lastPitLap={undefined}
        currentSessionType="Qualify"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
  });

  it('does not render "00" when lastPitLap is 0', () => {
    const { container } = renderInTable(
      <PitStatusCell
        onPitRoad={false}
        carTrackSurface={1}
        prevCarTrackSurface={1}
        lastLap={1}
        lastPitLap={0}
        currentSessionType="Qualify"
        dnf={false}
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
  });
});

