import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dashboard context so we can control global driverTagSettings
vi.mock('@irdashies/context', () => ({
  useDashboard: vi.fn(),
  usePitStopDuration: () => [],
  useSessionDrivers: () => [],
}));

import { DriverInfoRow } from './DriverInfoRow';
import { useDashboard } from '@irdashies/context';

const renderInTable = (component: React.ReactElement) =>
  render(
    <table>
      <tbody>{component}</tbody>
    </table>
  );

describe('DriverInfoRow tag placement fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the tag before the name when displayOrder places driverTag before driverName', () => {
    // Arrange: mock dashboard with driverTagSettings that map the driver to a custom group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useDashboard as unknown as any).mockReturnValue({
      currentDashboard: {
        generalSettings: {
          driverTagSettings: {
            groups: [{ id: 'g1', name: 'G1', icon: '🔥', color: 0xff0000 }],
            mapping: { 'Driver A': 'g1' },
            display: { enabled: true, widthPx: 6, displayStyle: 'badge' },
          },
        },
      },
    });

    const { container } = renderInTable(
      <DriverInfoRow
        carIdx={0}
        classColor={0}
        name="Driver A"
        isPlayer={false}
        hasFastestTime={false}
        isMultiClass={false}
        dnf={false}
        repair={false}
        penalty={false}
        slowdown={false}
        deltaDecimalPlaces={2}
        displayOrder={['driverTag', 'driverName']}
      />
    );

    const text = container.textContent ?? '';
    // Expect the emoji (tag) to appear before the name text
    const idxTag = text.indexOf('🔥');
    const idxName = text.indexOf('Driver A');
    expect(idxTag).toBeGreaterThanOrEqual(0);
    expect(idxName).toBeGreaterThanOrEqual(0);
    expect(idxTag).toBeLessThan(idxName);
  });

  it('renders the tag after the name when displayOrder places driverName before driverTag', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useDashboard as unknown as any).mockReturnValue({
      currentDashboard: {
        generalSettings: {
          driverTagSettings: {
            groups: [{ id: 'g1', name: 'G1', icon: '🔥', color: 0xff0000 }],
            mapping: { 'Driver A': 'g1' },
            display: { enabled: true, widthPx: 6, displayStyle: 'badge' },
          },
        },
      },
    });

    const { container } = renderInTable(
      <DriverInfoRow
        carIdx={0}
        classColor={0}
        name="Driver A"
        isPlayer={false}
        hasFastestTime={false}
        isMultiClass={false}
        dnf={false}
        repair={false}
        penalty={false}
        slowdown={false}
        deltaDecimalPlaces={2}
        displayOrder={['driverName', 'driverTag']}
      />
    );

    const text = container.textContent ?? '';
    const idxTag = text.indexOf('🔥');
    const idxName = text.indexOf('Driver A');
    expect(idxTag).toBeGreaterThanOrEqual(0);
    expect(idxName).toBeGreaterThanOrEqual(0);
    expect(idxTag).toBeGreaterThan(idxName);
  });
});
