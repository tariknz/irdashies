import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupSelect } from './GroupSelect';

const groups = [
  { id: 'team', name: 'Team', color: 0xf87171, icon: null },
  { id: 'league', name: 'League', color: 0x7dd3fc, icon: null },
];

describe('driver group keyboard interaction', () => {
  it('identifies the driver row independently of the current group value', () => {
    render(
      <GroupSelect
        value="team"
        label="Driver group for Alex Morgan (10001)"
        onChange={vi.fn()}
        groups={groups}
      />
    );
    expect(
      screen.getByRole('button', {
        name: 'Driver group for Alex Morgan (10001)',
      })
    ).toHaveAccessibleDescription('Team');
  });
  it('dismisses choices with Escape and returns to the trigger without changing the group', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(<GroupSelect value="team" onChange={change} groups={groups} />);
    const trigger = screen.getByRole('button', {
      name: 'Driver group',
    });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Team' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(change).not.toHaveBeenCalled();
  });

  it('selects a group, exposes the chosen value and closes when tabbing away', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState('team');
      return (
        <>
          <GroupSelect value={value} onChange={setValue} groups={groups} />
          <button>Next setting</button>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', {
      name: 'Driver group',
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'League' }));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription('League');
    await user.click(trigger);
    screen.getByRole('button', { name: 'League' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next setting' })).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
