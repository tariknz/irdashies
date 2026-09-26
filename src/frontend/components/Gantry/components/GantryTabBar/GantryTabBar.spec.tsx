import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GantryTabBar } from './GantryTabBar';

const renderTabBar = (alwaysOnTop: boolean) => {
  const onAlwaysOnTopChange = vi.fn();
  render(
    <GantryTabBar
      activeView="standings-incidents"
      onViewChange={vi.fn()}
      drivers={[]}
      followedCarIdx={null}
      onFollowChange={vi.fn()}
      alwaysOnTop={alwaysOnTop}
      onAlwaysOnTopChange={onAlwaysOnTopChange}
    />
  );
  return onAlwaysOnTopChange;
};

describe('GantryTabBar pin button', () => {
  it('pins when off', () => {
    const onChange = renderTabBar(false);
    const button = screen.getByRole('button', { name: 'Keep on top' });

    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('unpins when on', () => {
    const onChange = renderTabBar(true);
    const button = screen.getByRole('button', { name: 'Keep on top' });

    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith(false);
  });
});
