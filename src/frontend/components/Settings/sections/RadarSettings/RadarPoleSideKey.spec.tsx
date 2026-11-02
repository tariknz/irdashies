import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeybindingsMap } from '@irdashies/types';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import { RadarPoleSideKey } from './RadarPoleSideKey';

const withBridge = (getKeybindings: () => Promise<KeybindingsMap>) => {
  Object.defineProperty(window, 'keybindingsBridge', {
    configurable: true,
    writable: true,
    value: {
      getKeybindings,
      updateKeybinding: vi.fn(),
      resetKeybinding: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      onGamepadCaptured: () => () => undefined,
    },
  });
};

describe('RadarPoleSideKey', () => {
  afterEach(() => {
    Object.defineProperty(window, 'keybindingsBridge', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it('explains the key and shows its binding row', async () => {
    withBridge(() => Promise.resolve({ ...DEFAULT_KEYBINDINGS }));
    render(<RadarPoleSideKey />);

    expect(
      screen.getByText(/may draw the lanes on the wrong side/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/remembers it for future races/)
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Radar: Flip Pole Side')
    ).toBeInTheDocument();
  });

  it('still explains it when the bridge is missing', () => {
    render(<RadarPoleSideKey />);
    expect(
      screen.getByText(/may draw the lanes on the wrong side/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Radar: Flip Pole Side')).not.toBeInTheDocument();
  });

  it('shows no row when loading the bindings fails', async () => {
    withBridge(() => Promise.reject(new Error('no bridge')));
    render(<RadarPoleSideKey />);
    await Promise.resolve();
    expect(screen.queryByText('Radar: Flip Pole Side')).not.toBeInTheDocument();
  });
});
