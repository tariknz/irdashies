import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FormatSelect } from '@irdashies/frontend/components/Settings/components/FormatSelect';
import { PreviewSettingsButton } from './PreviewSettingsPanel';

vi.mock('./PreviewSettingsMenu', () => ({
  PreviewSettingsMenu: () => null,
}));
vi.mock('@irdashies/frontend/components/Settings/SettingsLoader', () => ({
  SettingsLoader: function SettingsLoader() {
    const [value, setValue] = useState('full');
    return (
      <FormatSelect
        label="iRacing"
        value={value}
        options={['full', 'short']}
        onChange={setValue}
        renderOption={(option) => option}
      />
    );
  },
}));

describe('preview settings modal', () => {
  beforeEach(() => {
    // jsdom lacks native modal behavior; browser checks cover inertness and focus.
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement
    ) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement
    ) {
      this.removeAttribute('open');
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('consumes Escape before it reaches the fullscreen handler', async () => {
    render(<PreviewSettingsButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    await screen.findByRole('dialog', { name: 'Preview settings' });

    const exitFullscreen = vi.fn();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) exitFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    try {
      fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(exitFullscreen).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(exitFullscreen).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('keydown', onKeyDown);
    }
  });

  it('keeps dropdowns in the preview theme and dismisses them before settings', async () => {
    render(<PreviewSettingsButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const trigger = await screen.findByRole('button', {
      name: 'iRacing rating format',
    });
    await userEvent.click(trigger);
    const list = screen.getByRole('listbox', {
      name: 'iRacing rating formats',
    });
    const shell = screen.getByRole('dialog').closest('.settings-shell');
    expect(shell).toContainElement(list);
    expect(screen.getByRole('main')).not.toContainElement(list);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toHaveFocus();
  });

  it.each(['', 'hidden'])(
    'restores the previous scroll lock (%j) on close',
    async (overflow) => {
      document.body.style.overflow = overflow;
      try {
        render(<PreviewSettingsButton />);
        await userEvent.click(
          screen.getByRole('button', { name: 'Configure' })
        );
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
        expect(screen.getByRole('dialog')).toHaveAttribute(
          'aria-modal',
          'true'
        );
        expect(document.body.style.overflow).toBe('hidden');
        await userEvent.click(
          screen.getByRole('button', { name: 'Close settings' })
        );
        expect(document.body.style.overflow).toBe(overflow);
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
      } finally {
        document.body.style.overflow = '';
      }
    }
  );
});
