import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionBarItemsList } from './SessionBarItemsList';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';

describe('session bar secondary options', () => {
  it('moves only rendered rows and preserves unconfigured IDs in their saved slots', async () => {
    const user = userEvent.setup();
    const reorder = vi.fn();
    const original = [
      'unknown-leading',
      'sessionName',
      'unknown-middle',
      'sessionTime',
      'unknown-trailing',
    ];
    function Harness() {
      const [items, setItems] = useState(original);
      return (
        <SessionBarItemsList
          items={items}
          onReorder={(next) => {
            reorder(next);
            setItems(next);
          }}
          getItemConfig={(id) =>
            id === 'sessionName' || id === 'sessionTime'
              ? { enabled: id === 'sessionName' }
              : undefined
          }
          updateItemConfig={vi.fn()}
        />
      );
    }
    const { container } = render(<Harness />);
    const renderedOrder = () =>
      [...container.querySelectorAll('[data-sortable-id]')].map((e) =>
        e.getAttribute('data-sortable-id')
      );
    expect(renderedOrder()).toEqual(['sessionName', 'sessionTime']);
    expect(
      screen.getByRole('button', { name: 'Move Session Name up' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Session Time down' })
    ).toBeDisabled();
    screen.getByRole('button', { name: 'Move Session Time up' }).focus();
    await user.keyboard('{Enter}');
    expect(renderedOrder()).toEqual(['sessionTime', 'sessionName']);
    expect(reorder).toHaveBeenLastCalledWith([
      'unknown-leading',
      'sessionTime',
      'unknown-middle',
      'sessionName',
      'unknown-trailing',
    ]);
    expect(
      screen.getByText('Session Time moved up. Position 1 of 2.')
    ).toHaveAttribute('role', 'status');
    expect(
      screen.getByRole('button', { name: 'Move Session Time down' })
    ).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(renderedOrder()).toEqual(['sessionName', 'sessionTime']);
    expect(reorder).toHaveBeenLastCalledWith(original);
    expect(
      screen.getByText('Session Time moved down. Position 2 of 2.')
    ).toHaveAttribute('role', 'status');
  });
  it.each([
    { direction: 'up', firstPosition: 2, lastPosition: 1, other: 'down' },
    { direction: 'down', firstPosition: 4, lastPosition: 5, other: 'up' },
  ])(
    'announces each repeated $direction move and retains focus between boundaries',
    async ({ direction, firstPosition, lastPosition, other }) => {
      const user = userEvent.setup();
      function Harness() {
        const [items, setItems] = useState([
          'sessionName',
          'sessionLaps',
          'sessionTime',
          'airTemperature',
          'wind',
        ]);
        return (
          <SessionBarItemsList
            items={items}
            onReorder={setItems}
            getItemConfig={() => ({ enabled: true })}
            updateItemConfig={vi.fn()}
          />
        );
      }
      const { container } = render(<Harness />);
      const control = screen.getByRole('button', {
        name: `Move Session Time ${direction}`,
      });
      control.focus();
      await user.keyboard('{Enter}');
      expect(control).toHaveFocus();
      expect(
        screen.getByText(
          `Session Time moved ${direction}. Position ${firstPosition} of 5.`
        )
      ).toHaveAttribute('role', 'status');
      await user.keyboard('{Enter}');
      expect(
        screen.getByText(
          `Session Time moved ${direction}. Position ${lastPosition} of 5.`
        )
      ).toHaveAttribute('role', 'status');
      expect(
        [...container.querySelectorAll('[data-sortable-id]')][lastPosition - 1]
      ).toHaveAttribute('data-sortable-id', 'sessionTime');
      expect(control).toBeDisabled();
      expect(
        screen.getByRole('button', { name: `Move Session Time ${other}` })
      ).toHaveFocus();
    }
  );
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
    expect(
      screen.getByText('Session Time moved up. Position 1 of 3.')
    ).toHaveAttribute('role', 'status');
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
