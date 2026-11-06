import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPopover } from './SettingsPopover';

function Popup() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="settings-shell">
      <button ref={ref} onClick={() => setOpen(!open)}>
        Actions
      </button>
      <SettingsPopover
        open={open}
        anchorRef={ref}
        onClose={() => setOpen(false)}
        label="Profile actions"
      >
        <button>Clone</button>
        <button aria-pressed="true">Rename</button>
        <button>Delete</button>
      </SettingsPopover>
      <button>Next field</button>
    </div>
  );
}
afterEach(() => vi.restoreAllMocks());
describe('SettingsPopover', () => {
  it('flips a bottom-edge popup, keeps its theme and focuses the selected item', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.tagName === 'BUTTON'
          ? {
              left: 950,
              right: 1000,
              top: 700,
              bottom: 736,
              width: 50,
              height: 36,
              x: 950,
              y: 700,
              toJSON() {
                return {};
              },
            }
          : {
              left: 0,
              right: 200,
              top: 0,
              bottom: 120,
              width: 200,
              height: 120,
              x: 0,
              y: 0,
              toJSON() {
                return {};
              },
            };
      }
    );
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
    render(<Popup />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const panel = screen.getByRole('group', { name: 'Profile actions' });
    expect(panel.closest('.settings-shell')).not.toBeNull();
    expect(parseFloat(panel.style.top)).toBeLessThan(700);
    expect(
      parseFloat(panel.style.left) + parseFloat(panel.style.width)
    ).toBeLessThanOrEqual(window.innerWidth - 8);
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });
  it('closes when the viewport or scrolled anchor changes', async () => {
    render(<Popup />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.scroll(document);
    expect(screen.queryByRole('group')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('group')).toBeNull();
  });
});
