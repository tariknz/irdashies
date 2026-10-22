import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WidgetContainer } from './WidgetContainer';

vi.mock('@irdashies/context', () => ({
  useContainerOffset: () => ({ x: 0, y: 0 }),
  useDashboard: () => ({ containerBoundsInfo: null }),
}));

describe('WidgetContainer scaling', () => {
  it('scales content while keeping the edit controls and layout in screen coordinates', () => {
    const { container } = render(
      <WidgetContainer
        widget={{
          id: 'standings',
          enabled: true,
          scale: 200,
          layout: { x: 20, y: 40, width: 400, height: 300 },
        }}
        editMode
        zIndex={1}
        onLayoutChange={vi.fn()}
        onOpenSettings={vi.fn()}
      >
        <div>Standings content</div>
      </WidgetContainer>
    );
    expect(container.querySelector('[data-widget-id="standings"]')).toHaveStyle(
      {
        width: '400px',
        height: '300px',
        transform: 'translate(20px, 40px)',
      }
    );
    expect(
      screen.getByText('Standings content').closest('[data-widget-scale]')
    ).toHaveAttribute('data-widget-scale', '200');
    expect(
      screen
        .getByRole('button', { name: 'Open settings for Standings' })
        .closest('[data-widget-scale]')
    ).toBeNull();
  });
});
