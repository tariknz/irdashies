import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormatSelect } from './FormatSelect';

/**
 * The rating-format dropdown.
 *
 * These options have no useful names, so the control shows the rendering
 * instead. That makes the open/closed behaviour the whole interface: if the
 * panel cannot be opened, or will not close, there is no way to tell what is
 * selected or to change it.
 */
const OPTIONS = ['plates', 'chip-both', 'chip-none'] as const;

const setup = (value: (typeof OPTIONS)[number] = 'plates') => {
  const onChange = vi.fn();
  render(
    <FormatSelect
      label="Le Mans Ultimate"
      value={value}
      options={OPTIONS}
      renderOption={(option) => <span>{option}</span>}
      onChange={onChange}
    />
  );
  return { onChange };
};

describe('FormatSelect', () => {
  it('shows the selected option and not the others', async () => {
    setup('chip-both');

    expect(screen.getByRole('button')).toHaveTextContent('chip-both');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on click and lists every option', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /format/i }));

    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([...OPTIONS]);
  });

  it('marks the current option in the list', async () => {
    setup('chip-none');
    await userEvent.click(screen.getByRole('button', { name: /format/i }));

    const selected = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.map((o) => o.textContent)).toEqual(['chip-none']);
  });

  it('reports a choice and closes', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: /format/i }));
    await userEvent.click(screen.getByRole('option', { name: 'chip-none' }));

    expect(onChange).toHaveBeenCalledWith('chip-none');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape without choosing', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: /format/i }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on a click outside without choosing', async () => {
    // Otherwise the panel outlives the click that should have dismissed it.
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: /format/i }));
    await userEvent.click(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
