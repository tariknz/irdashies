import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionBarItemsList } from './SessionBarItemsList';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';

describe('session bar secondary options', () => {
  it('reorders with a keyboard and keeps focus on the moved row at a boundary', async () => {
    const user = userEvent.setup();
    const reorder = vi.fn();
    const update = vi.fn();
    function Harness() {
      const [items, setItems] = useState([
        'sessionName',
        'sessionTime',
        'airTemperature',
      ]);
      return (
        <SessionBarItemsList
          items={items}
          onReorder={(next) => {
            reorder(next);
            setItems(next);
          }}
          getItemConfig={() => ({ enabled: true })}
          updateItemConfig={update}
        />
      );
    }
    const { container } = render(<Harness />);
    screen.getByRole('button', { name: 'Move Session Time up' }).focus();
    await user.keyboard('{Enter}');
    expect(reorder).toHaveBeenLastCalledWith([
      'sessionTime',
      'sessionName',
      'airTemperature',
    ]);
    expect(
      [...container.querySelectorAll('[data-sortable-id]')].map((e) =>
        e.getAttribute('data-sortable-id')
      )
    ).toEqual(['sessionTime', 'sessionName', 'airTemperature']);
    expect(
      screen.getByRole('button', { name: 'Move Session Time up' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Move Session Time down',
      })
    ).toHaveFocus();
    expect(screen.getByText('Session Time moved up.')).toHaveAttribute(
      'role',
      'status'
    );
    expect(update).not.toHaveBeenCalled();
  });
  it('labels each enabled option visibly and updates only the selected property', () => {
    const update = vi.fn();
    const { rerender } = render(
      <SessionBarItemsList
        items={['sessionTime', 'sessionLaps', 'airTemperature']}
        onReorder={vi.fn()}
        getItemConfig={() => ({ enabled: true })}
        updateItemConfig={update}
      />
    );
    const timeMode = screen.getByRole('combobox', {
      name: 'Session Time mode',
    });
    expect(timeMode.closest('label')).toHaveTextContent('Mode');
    expect(
      screen
        .getByRole('combobox', { name: 'Session Time total format' })
        .closest('label')
    ).toHaveTextContent('Format');
    expect(
      screen
        .getByRole('combobox', { name: 'Session Time label style' })
        .closest('label')
    ).toHaveTextContent('Labels');
    fireEvent.change(timeMode, { target: { value: 'Elapsed' } });
    expect(update).toHaveBeenLastCalledWith('sessionTime', { mode: 'Elapsed' });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Session Laps mode' }),
      { target: { value: 'Remaining' } }
    );
    expect(update).toHaveBeenLastCalledWith('sessionLaps', {
      mode: 'Remaining',
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Air Temperature units' }),
      { target: { value: 'Imperial' } }
    );
    expect(update).toHaveBeenLastCalledWith('airTemperature', {
      unit: 'Imperial',
    });
    rerender(
      <SessionBarItemsList
        items={['sessionTime']}
        onReorder={vi.fn()}
        getItemConfig={() => ({ enabled: false })}
        updateItemConfig={update}
      />
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Session Time' }));
    expect(update).toHaveBeenLastCalledWith('sessionTime', { enabled: true });
  });
});
