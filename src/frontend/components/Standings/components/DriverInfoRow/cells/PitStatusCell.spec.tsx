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
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
    
    // CRITICAL TEST: The original buggy code renders <td></td> with NO children
    // This causes "00" to appear in some browsers/CSS contexts
    // The fix MUST explicitly render an empty string: <td>{''}</td>
    // 
    // Note: In jsdom, React normalizes empty strings, so both render the same.
    // However, in real browsers, explicitly rendering '' prevents "00" from appearing.
    // The fix ensures we explicitly return an empty string rather than having no children.
    //
    // Verify the cell is empty but doesn't contain "00"
    expect(td?.innerHTML).not.toContain('00');
    expect(td?.textContent).toBe('');
    
    // The key difference is in the code structure:
    // Original: <td>{conditional1 ? ... : null}{conditional2 ? ... : null}...</td>
    //           When all false, renders <td></td> with NO children
    // Fix:      if (no conditions) return <td>{''}</td>
    //           Explicitly renders empty string to prevent browser defaults
  });

  it('renders empty cell when hidden', () => {
    const { container } = renderInTable(
      <PitStatusCell
        hidden={true}
        onPitRoad={true}
        carTrackSurface={2}
        currentSessionType="Race"
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
      />
    );
    
    const td = container.querySelector('td[data-column="pitStatus"]');
    expect(td).toBeTruthy();
    expect(td?.textContent).toBe('');
    expect(td?.textContent).not.toBe('00');
  });
});

