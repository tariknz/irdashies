import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LapGraphDriverList } from './LapGraphDriverList';
import type { DriverListEntry } from './LapGraphDriverList';

const drivers: DriverListEntry[] = [
  {
    carIdx: 1,
    carNumber: '11',
    displayName: 'Verstappen',
    position: 1,
    isPlayer: false,
    hasLine: true,
  },
  {
    carIdx: 2,
    carNumber: '44',
    displayName: 'Hamilton',
    position: 2,
    isPlayer: true,
    hasLine: true,
  },
  {
    carIdx: 3,
    carNumber: '16',
    displayName: 'Leclerc',
    position: 3,
    isPlayer: false,
    hasLine: false,
  },
];

const renderList = (
  props?: Partial<Parameters<typeof LapGraphDriverList>[0]>
) => {
  const onToggle = vi.fn();
  const onHover = vi.fn();
  render(
    <LapGraphDriverList
      drivers={drivers}
      classColor="#22c55e"
      shownCarIdxs={[1]}
      focusedCarIdx={null}
      onToggle={onToggle}
      onHover={onHover}
      {...props}
    />
  );
  return { onToggle, onHover };
};

describe('LapGraphDriverList', () => {
  it('lists the class in running order', () => {
    renderList();

    const names = screen
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(names).toEqual(['1#11Verstappen', '2#44Hamilton', '3#16Leclerc']);
  });

  it('marks pinned cars and the player as shown', () => {
    renderList();

    expect(screen.getByTitle(/Hide Verstappen/)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // The player's line is always drawn, pinned or not.
    expect(screen.getByTitle(/always drawn/)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTitle(/no completed laps yet/)).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('toggles a car on click and reports hover both ways', () => {
    const { onToggle, onHover } = renderList();

    const row = screen.getByTitle(/Hide Verstappen/);
    fireEvent.pointerEnter(row);
    fireEvent.click(row);

    expect(onHover).toHaveBeenCalledWith(1);
    expect(onToggle).toHaveBeenCalledWith(1);

    fireEvent.pointerLeave(row);

    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('does not toggle a car with no laps yet, but still reports hover', () => {
    const { onToggle, onHover } = renderList();

    // aria-disabled rather than disabled, so the row keeps firing pointer
    // events and cannot strand the highlight on the previous car.
    const row = screen.getByTitle(/no completed laps yet/);
    fireEvent.pointerEnter(row);
    fireEvent.click(row);

    expect(onHover).toHaveBeenCalledWith(3);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not toggle the player, whose line is always drawn', () => {
    const { onToggle } = renderList();

    fireEvent.click(screen.getByTitle(/always drawn/));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not report a player with no completed laps as shown', () => {
    const { onToggle } = renderList({
      drivers: drivers.map((entry) =>
        entry.isPlayer ? { ...entry, hasLine: false } : entry
      ),
    });

    const row = screen.getByTitle('Hamilton has no completed laps yet');
    expect(row).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(row);

    expect(onToggle).not.toHaveBeenCalled();
  });
});
