import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';
import type {
  KeybindingsBridge,
  KeybindingRegistrationStatuses,
} from '@irdashies/types';
import { KeybindingsSettings } from './KeybindingsSettings';
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: [{ id: 'standings' }] },
  }),
}));
const bridge: KeybindingsBridge = {
  getKeybindings: vi.fn(),
  getRegistrationStatuses: vi.fn(),
  updateKeybinding: vi.fn(),
  resetKeybinding: vi.fn(),
  resetAllKeybindings: vi.fn(),
  startRecording: vi.fn(async () => undefined),
  stopRecording: vi.fn(async () => undefined),
  onGamepadCaptured: vi.fn(() => () => undefined),
};
const startRecording = async () => {
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Change shortcut for Hide / Show UI',
    })
  );
  await screen.findByText('Press keys...');
};
describe('KeybindingsSettings registration feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.startRecording).mockReset().mockResolvedValue(undefined);
    vi.mocked(bridge.stopRecording).mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, 'keybindingsBridge', {
      configurable: true,
      value: bridge,
    });
    vi.mocked(bridge.getKeybindings).mockResolvedValue(
      structuredClone(DEFAULT_KEYBINDINGS)
    );
    vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue({});
  });
  afterEach(() => {
    Object.defineProperty(window, 'keybindingsBridge', {
      configurable: true,
      value: undefined,
    });
  });

  it.each(['invalid', 'unavailable'] as const)(
    'shows persisted %s feedback at startup without recording',
    async (status) => {
      vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue({
        'toggle-hide-ui': { status, message: KEYBINDING_MESSAGES[status] },
      });
      render(<KeybindingsSettings />);
      const feedback = await screen.findByRole('status');
      expect(feedback).toHaveTextContent(KEYBINDING_MESSAGES[status]);
      expect(
        screen.getByRole('button', {
          name: 'Change shortcut for Hide / Show UI',
        })
      ).toHaveAccessibleDescription(KEYBINDING_MESSAGES[status]);
      expect(screen.getByText('Alt + H')).toBeInTheDocument();
      expect(bridge.startRecording).not.toHaveBeenCalled();
    }
  );

  it('shows registration feedback for dynamic widget bindings', async () => {
    vi.mocked(bridge.getKeybindings).mockResolvedValue({
      ...DEFAULT_KEYBINDINGS,
      'toggle-widget:standings': {
        accelerator: 'Alt+1',
        label: 'Standings',
        description: '',
      },
    });
    vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue({
      'toggle-widget:standings': {
        status: 'unavailable',
        message: KEYBINDING_MESSAGES.unavailable,
      },
    });
    render(<KeybindingsSettings />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      KEYBINDING_MESSAGES.unavailable
    );
    expect(
      screen.getByRole('button', { name: 'Change shortcut for Standings' })
    ).toHaveAccessibleDescription(KEYBINDING_MESSAGES.unavailable);
  });

  it.each([
    KEYBINDING_MESSAGES.unavailable,
    KEYBINDING_MESSAGES.invalid,
    'Shortcut already bound to "Edit Layout" in irDashies. Choose another combination.',
  ])(
    'shows rejected edit feedback while preserving the working shortcut: %s',
    async (message) => {
      vi.mocked(bridge.updateKeybinding).mockResolvedValue({
        ok: false,
        message,
      });
      render(<KeybindingsSettings />);
      await startRecording();
      fireEvent.keyDown(window, { key: 'F8' });
      expect(await screen.findByRole('status')).toHaveTextContent(
        `F8: ${message}`
      );
      await waitFor(() => expect(bridge.stopRecording).toHaveBeenCalledOnce());
      expect(screen.getByText('Alt + H')).toBeInTheDocument();
    }
  );

  it('refreshes runtime feedback after recording stops and after reset', async () => {
    const statuses: KeybindingRegistrationStatuses = {
      'toggle-hide-ui': {
        status: 'unavailable',
        message: KEYBINDING_MESSAGES.unavailable,
      },
    };
    vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue(statuses);
    vi.mocked(bridge.updateKeybinding).mockResolvedValue({
      ok: true,
      bindings: {
        ...DEFAULT_KEYBINDINGS,
        'toggle-hide-ui': {
          ...DEFAULT_KEYBINDINGS['toggle-hide-ui'],
          accelerator: 'F8',
          isDefault: false,
        },
      },
    });
    vi.mocked(bridge.stopRecording).mockImplementation(async () => {
      vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue({});
    });
    vi.mocked(bridge.resetKeybinding).mockResolvedValue(DEFAULT_KEYBINDINGS);
    render(<KeybindingsSettings />);
    await screen.findByRole('status');
    await startRecording();
    fireEvent.keyDown(window, { key: 'F8' });
    await screen.findByText('F8');
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    );
    vi.mocked(bridge.getRegistrationStatuses).mockResolvedValue(statuses);
    fireEvent.click(screen.getByTitle('Reset to default'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      KEYBINDING_MESSAGES.unavailable
    );
    expect(screen.getByText('Alt + H')).toBeInTheDocument();
  });

  it('cancels with Escape without changing the binding', async () => {
    render(<KeybindingsSettings />);
    await startRecording();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(bridge.stopRecording).toHaveBeenCalledOnce());
    expect(bridge.updateKeybinding).not.toHaveBeenCalled();
  });

  it('restores shortcuts on unmount during recording', async () => {
    const view = render(<KeybindingsSettings />);
    await startRecording();
    view.unmount();
    expect(bridge.stopRecording).toHaveBeenCalledOnce();
  });

  it('restores shortcuts if unmounted while starting recording', async () => {
    let completeStart: (() => void) | undefined;
    vi.mocked(bridge.startRecording).mockReturnValue(
      new Promise<void>((resolve) => {
        completeStart = resolve;
      })
    );
    const view = render(<KeybindingsSettings />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Change shortcut for Hide / Show UI',
      })
    );
    view.unmount();
    await act(async () => completeStart?.());
    expect(bridge.stopRecording).toHaveBeenCalledOnce();
  });

  it('keeps controller capture working', async () => {
    vi.mocked(bridge.updateKeybinding).mockResolvedValue({
      ok: true,
      bindings: DEFAULT_KEYBINDINGS,
    });
    render(<KeybindingsSettings />);
    await startRecording();
    const capture = vi.mocked(bridge.onGamepadCaptured).mock.calls.at(-1)?.[0];
    if (!capture) throw new Error('Gamepad capture was not subscribed');
    await act(async () => capture('gamepad:btn0+gamepad:btn5'));
    expect(bridge.updateKeybinding).toHaveBeenCalledWith(
      'toggle-hide-ui',
      'gamepad:btn0+gamepad:btn5',
      expect.any(Object)
    );
    expect(bridge.stopRecording).toHaveBeenCalledOnce();
  });
});
