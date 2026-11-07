import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormatSelect } from '@irdashies/frontend/components/Settings/components/FormatSelect';
import { PreviewSettingsButton } from './PreviewSettingsPanel';

vi.mock('./PreviewSettingsMenu', () => ({
  PreviewSettingsMenu: () => null,
}));
vi.mock('@irdashies/frontend/components/Settings/SettingsLoader', () => ({
  SettingsLoader: function SettingsLoader() {
    const [value, setValue] = useState('full');
    const { widgetId } = useParams();
    return (
      <>
        <h2>{widgetId}</h2>
        <FormatSelect
          label="iRacing"
          value={value}
          options={['full', 'short']}
          onChange={setValue}
          renderOption={(option) => option}
        />
      </>
    );
  },
}));

describe('preview settings panel', () => {
  it('opens the current preview widget and keeps its page until reopened', async () => {
    const { rerender } = render(
      <PreviewSettingsButton defaultWidget="input" />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    await screen.findByRole('heading', { name: 'input' });
    rerender(<PreviewSettingsButton defaultWidget="relative" />);
    expect(screen.getByRole('heading', { name: 'input' })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Close settings' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    await screen.findByRole('heading', { name: 'relative' });
  });

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
    'leaves the existing page scroll state (%j) unchanged',
    async (overflow) => {
      document.body.style.overflow = overflow;
      try {
        render(<PreviewSettingsButton />);
        await userEvent.click(
          screen.getByRole('button', { name: 'Configure' })
        );
        expect(screen.getByRole('dialog')).toHaveAttribute(
          'aria-modal',
          'false'
        );
        expect(document.body.style.overflow).toBe(overflow);
        await userEvent.click(
          screen.getByRole('button', { name: 'Close settings' })
        );
        expect(document.body.style.overflow).toBe(overflow);
      } finally {
        document.body.style.overflow = '';
      }
    }
  );

  it('keeps the current settings mounted when minimized', async () => {
    render(<PreviewSettingsButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const trigger = await screen.findByRole('button', {
      name: 'iRacing rating format',
    });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: 'short' }));
    const main = screen.getByRole('main');
    main.scrollTop = 140;

    await userEvent.click(
      screen.getByRole('button', { name: 'Minimize settings' })
    );
    expect(screen.queryByRole('main')).toBeNull();
    expect(trigger).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Restore settings' })
    );
    expect(screen.getByRole('main')).toBe(main);
    expect(main.scrollTop).toBe(140);
    expect(trigger).toHaveTextContent('short');
  });

  it('supports keyboard resizing and stays inside a smaller viewport', async () => {
    render(<PreviewSettingsButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const handle = screen.getByRole('button', { name: 'Resize settings' });
    const panel = handle.parentElement;
    if (!panel) throw new Error('Resize handle must be inside the panel');
    const originalWidth = parseFloat(panel.style.width);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(parseFloat(panel.style.width)).toBe(originalWidth - 20);
    const originalHeight = parseFloat(panel.style.height);
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(parseFloat(panel.style.height)).toBe(originalHeight - 20);

    const { innerWidth, innerHeight } = window;
    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 390,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 240,
      });
      fireEvent(window, new Event('resize'));
      expect(parseFloat(panel.style.width)).toBe(374);
      expect(parseFloat(panel.style.height)).toBe(224);
      expect(panel.style.left).toBe('8px');
      expect(panel.style.top).toBe('8px');
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: innerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: innerHeight,
      });
    }
  });

  it('drags the minimized bar to the viewport edges and restores the full panel in view', async () => {
    render(<PreviewSettingsButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const panel = screen.getByRole('button', {
      name: 'Resize settings',
    }).parentElement;
    if (!panel) throw new Error('Missing settings panel');
    const header = panel.firstElementChild;
    if (!(header instanceof HTMLElement))
      throw new Error('Missing drag handle');
    const width = parseFloat(panel.style.width);
    const height = parseFloat(panel.style.height);
    await userEvent.click(
      screen.getByRole('button', { name: 'Minimize settings' })
    );
    header.setPointerCapture = vi.fn();
    const rect = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      ...new DOMRect(),
      width: 320,
      height: 56,
    });
    try {
      fireEvent.pointerDown(header, {
        pointerId: 1,
        button: 0,
        clientX: 400,
        clientY: 120,
      });
      fireEvent.pointerMove(header, {
        pointerId: 1,
        clientX: 2000,
        clientY: 2000,
      });
      fireEvent.pointerUp(header, { pointerId: 1 });
      expect(parseFloat(panel.style.left)).toBe(window.innerWidth - 320 - 8);
      expect(parseFloat(panel.style.top)).toBe(window.innerHeight - 56 - 8);
      await userEvent.click(
        screen.getByRole('button', { name: 'Restore settings' })
      );
      expect(parseFloat(panel.style.width)).toBe(width);
      expect(parseFloat(panel.style.height)).toBe(height);
      expect(parseFloat(panel.style.left)).toBe(window.innerWidth - width - 8);
      expect(parseFloat(panel.style.top)).toBe(window.innerHeight - height - 8);
    } finally {
      rect.mockRestore();
    }
  });
});
