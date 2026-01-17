import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { DriverNameCell } from './DriverNameCell';

const renderInTable = (component: ReactElement) => {
  return render(
    <table>
      <tbody>
        <tr>{component}</tr>
      </tbody>
    </table>
  );
};

describe('DriverNameCell', () => {
  it('renders the driver name when not hidden', () => {
    const { container } = renderInTable(
      <DriverNameCell name="Driver A" />
    );

    expect(container.textContent).toContain('Driver A');
  });

  it('hides the driver name when hidden', () => {
    const { container } = renderInTable(
      <DriverNameCell name="Driver A" hidden />
    );

    expect(container.textContent).not.toContain('Driver A');
  });

  it('shows OUT status when conditions are met', () => {
    const { container } = renderInTable(
      <DriverNameCell
        name="Driver A"
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={1}
      />
    );

    expect(container.textContent).toContain('OUT');
  });

  it('does not show OUT when showStatusBadges is false', () => {
    const { container } = renderInTable(
      <DriverNameCell
        name="Driver A"
        showStatusBadges={false}
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={1}
      />
    );

    expect(container.textContent).not.toContain('OUT');
  });

  it('does not show OUT when car is off track', () => {
    const { container } = renderInTable(
      <DriverNameCell
        name="Driver A"
        onPitRoad={false}
        lastPitLap={3}
        lastLap={3}
        carTrackSurface={-1}
      />
    );

    expect(container.textContent).not.toContain('OUT');
  });

  it('toggles radio icon visibility based on radioActive', () => {
    const { container, rerender } = renderInTable(
      <DriverNameCell name="Driver A" radioActive />
    );
    const icon = container.querySelector('span svg');
    expect(icon).toBeTruthy();
    expect(icon?.parentElement?.className).toContain('w-4');

    rerender(
      <table>
        <tbody>
          <tr>
            <DriverNameCell name="Driver A" radioActive={false} />
          </tr>
        </tbody>
      </table>
    );
    const hiddenIcon = container.querySelector('span svg');
    expect(hiddenIcon).toBeTruthy();
    expect(hiddenIcon?.parentElement?.className).toContain('w-0');
  });
});
