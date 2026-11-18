import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('confirmation keyboard recovery', () => {
  it('returns to main when confirming removes the invoking control', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      const [deleted, setDeleted] = useState(false);
      return (
        <main tabIndex={-1} data-testid="page">
          {!deleted && (
            <button onClick={() => setOpen(true)}>Remove saved item</button>
          )}
          <ConfirmDialog
            isOpen={open}
            title="Remove item?"
            message="This removes the item."
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              setDeleted(true);
              setOpen(false);
            }}
          />
        </main>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Remove saved item' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('page')).toHaveFocus();
  });
  it('contains focus, cancels safely and restores both focus and prior inert state', async () => {
    const confirm = vi.fn();
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Reset saved data</button>
          <div data-testid="already-inert" inert>
            Unavailable background
          </div>
          <ConfirmDialog
            isOpen={open}
            title="Reset saved data?"
            message="This clears calibration."
            onConfirm={confirm}
            onCancel={() => setOpen(false)}
          />
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', {
      name: 'Reset saved data',
    });
    await user.click(trigger);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const reset = screen.getByRole('button', { name: 'Confirm' });
    expect(cancel).toHaveFocus();
    expect(trigger).toHaveAttribute('inert');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'This clears calibration.'
    );
    await user.tab({ shift: true });
    expect(reset).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute('inert');
    expect(screen.getByTestId('already-inert')).toHaveAttribute('inert');
    expect(confirm).not.toHaveBeenCalled();
  });
});
