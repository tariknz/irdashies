import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewSettingsButton } from './PreviewSettingsPanel';

vi.mock('./PreviewSettingsMenu', () => ({
  PreviewSettingsMenu: () => null,
}));
vi.mock('@irdashies/frontend/components/Settings/SettingsLoader', () => ({
  SettingsLoader: () => null,
}));

describe('preview settings Escape handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('consumes Escape before it reaches the fullscreen handler', async () => {
    render(
      <PreviewSettingsButton
        activeWidgets={new Set()}
        onToggleWidget={vi.fn()}
      />
    );
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
});
