import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { GantryPitStopSettings } from './GantryPitStopSettings';
import { newPitProfile, withGantryPitStops } from './gantryPitStopEdits';

// Saving goes through the dashboard, so the mock feeds each saved layout
// back to the component the way the real context does.
const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    getDashboard: () => dashboard,
    setDashboard: (next: DashboardLayout | undefined) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore((onChange) => {
        mocks.listeners.add(onChange);
        return () => mocks.listeners.delete(onChange);
      }, mocks.getDashboard),
      onDashboardUpdated: mocks.setDashboard,
    }),
    useSessionDrivers: () => [],
  };
});

beforeEach(() => {
  const empty = {
    widgets: [{ id: 'gantry', enabled: true, layout: {}, config: {} }],
  } as unknown as DashboardLayout;
  mocks.setDashboard(
    withGantryPitStops(empty, { profiles: [newPitProfile('gt4car', 'GT4')] })
  );
});

afterEach(() => vi.restoreAllMocks());

const savedName = () =>
  (
    mocks.getDashboard()?.widgets[0].config as {
      pitStops: { profiles: { name: string }[] };
    }
  ).pitStops.profiles[0].name;

describe('GantryPitStopSettings', () => {
  it('keeps a space typed in the profile name', () => {
    render(<GantryPitStopSettings />);
    const input = screen.getByRole('textbox', { name: 'Profile name' });

    fireEvent.change(input, { target: { value: 'My ' } });
    expect(input).toHaveProperty('value', 'My ');
    expect(savedName()).toBe('My');

    fireEvent.change(input, { target: { value: 'My Team' } });
    expect(input).toHaveProperty('value', 'My Team');
    expect(savedName()).toBe('My Team');
  });

  it('shows the saved name once editing ends', () => {
    render(<GantryPitStopSettings />);
    const input = screen.getByRole('textbox', { name: 'Profile name' });
    fireEvent.change(input, { target: { value: 'Team  ' } });
    fireEvent.blur(input);
    expect(input).toHaveProperty('value', 'Team');
  });

  it('opens the file picker from a focusable Import button', () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<GantryPitStopSettings />);
    const button = screen.getByRole('button', { name: 'Import' });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
