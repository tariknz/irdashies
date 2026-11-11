import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPreviewPanelContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { SettingsPreviewLayout } from './SettingsPreviewLayout';

vi.mock('@irdashies/context', () => ({
  useElementSize: () => ({ width: 1280, height: 700 }),
}));
vi.mock('./WidgetPreview', () => ({ WidgetPreview: () => null }));

function Page() {
  const preference = useState(420);
  const [widget, setWidget] = useState('input');
  return (
    <SettingsPreviewPanelContext value={preference}>
      <button onClick={() => setWidget('radar')}>Switch widget</button>
      <SettingsPreviewLayout key={widget} widgetId={widget}>
        <p>{widget}</p>
      </SettingsPreviewLayout>
    </SettingsPreviewPanelContext>
  );
}

describe('settings preview divider', () => {
  it('resizes by keyboard within both column minimums', () => {
    render(<Page />);
    const divider = screen.getByRole('separator', {
      name: 'Resize preview panel',
    });
    fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true });
    expect(divider).toHaveAttribute('aria-valuenow', '470');
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '660');
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '660');
    fireEvent.keyDown(divider, { key: 'Home' });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '320');
  });
  it('keeps the preferred width when the widget settings page changes', () => {
    render(<Page />);
    fireEvent.keyDown(screen.getByRole('separator'), {
      key: 'ArrowLeft',
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch widget' }));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '470'
    );
    fireEvent.doubleClick(screen.getByRole('separator'));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '420'
    );
  });
});
