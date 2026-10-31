import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';
import type { KeybindingsBridge } from '@irdashies/types';
import { BindingRow } from './KeybindingsSettings';

const bridge: KeybindingsBridge = {
  getKeybindings: vi.fn(),
  getRegistrationErrors: vi.fn(),
  updateKeybinding: vi.fn(),
  resetKeybinding: vi.fn(),
  resetAllKeybindings: vi.fn(),
  startRecording: vi.fn(async () => undefined),
  stopRecording: vi.fn(async () => undefined),
  onGamepadCaptured: () => () => undefined,
};
const onUpdated = vi.fn();
const renderRow = () =>
  render(
    <BindingRow
      actionId="toggle-hide-ui"
      entry={DEFAULT_KEYBINDINGS['toggle-hide-ui']}
      onUpdated={onUpdated}
    />
  );
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'keybindingsBridge', {
    configurable: true,
    value: bridge,
  });
  vi.mocked(bridge.getRegistrationErrors).mockResolvedValue({});
});
afterEach(() =>
  Object.defineProperty(window, 'keybindingsBridge', {
    configurable: true,
    value: undefined,
  })
);

it.each(['invalid', 'unavailable'] as const)(
  'shows persisted %s feedback before recording',
  async (status) => {
    vi.mocked(bridge.getRegistrationErrors).mockResolvedValue({
      'toggle-hide-ui': KEYBINDING_MESSAGES[status],
    });
    renderRow();
    expect(await screen.findByRole('status')).toHaveTextContent(
      KEYBINDING_MESSAGES[status]
    );
    expect(bridge.startRecording).not.toHaveBeenCalled();
  }
);

it.each([
  KEYBINDING_MESSAGES.invalid,
  KEYBINDING_MESSAGES.unavailable,
  'Shortcut already bound in irDashies.',
])('preserves the saved shortcut after rejection: %s', async (message) => {
  vi.mocked(bridge.updateKeybinding).mockResolvedValue({ error: message });
  renderRow();
  fireEvent.click(
    screen.getByRole('button', { name: 'Change shortcut for Hide / Show UI' })
  );
  await screen.findByText('Press keys...');
  fireEvent.keyDown(window, { key: 'F8' });
  expect(await screen.findByRole('status')).toHaveTextContent(`F8: ${message}`);
  expect(screen.getByText('Alt + H')).toBeInTheDocument();
  expect(onUpdated).not.toHaveBeenCalled();
  await waitFor(() => expect(bridge.stopRecording).toHaveBeenCalledOnce());
});

it('refreshes startup feedback after recording and a successful edit', async () => {
  vi.mocked(bridge.getRegistrationErrors)
    .mockResolvedValueOnce({
      'toggle-hide-ui': KEYBINDING_MESSAGES.unavailable,
    })
    .mockResolvedValue({});
  vi.mocked(bridge.updateKeybinding).mockResolvedValue({
    ...DEFAULT_KEYBINDINGS,
  });
  renderRow();
  await screen.findByRole('status');
  fireEvent.click(
    screen.getByRole('button', { name: 'Change shortcut for Hide / Show UI' })
  );
  await screen.findByText('Press keys...');
  fireEvent.keyDown(window, { key: 'F8' });
  await waitFor(() => expect(bridge.stopRecording).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
  expect(onUpdated).toHaveBeenCalledWith(DEFAULT_KEYBINDINGS);
});
