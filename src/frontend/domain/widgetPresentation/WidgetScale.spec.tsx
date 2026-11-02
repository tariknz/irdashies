import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WidgetScale } from './WidgetScale';

describe('WidgetScale', () => {
  it('keeps a full-size logical area at the default without a transform', () => {
    render(
      <WidgetScale>
        <div data-testid="content" />
      </WidgetScale>
    );
    expect(screen.getByTestId('content').parentElement).toHaveStyle({
      width: '100%',
      height: '100%',
    });
    expect(screen.getByTestId('content').parentElement?.style.transform).toBe(
      ''
    );
  });

  it('compensates both dimensions without changing the outer frame', () => {
    const { rerender } = render(
      <WidgetScale scale={200}>
        <div data-testid="content" />
      </WidgetScale>
    );
    const content = screen.getByTestId('content');
    const frame = content.parentElement?.parentElement;
    expect(content.parentElement).toHaveStyle({
      width: '50%',
      height: '50%',
      transform: 'scale(2)',
    });
    expect(frame).toHaveClass('w-full', 'h-full', 'overflow-hidden');

    rerender(
      <WidgetScale scale={50}>
        <div data-testid="content" />
      </WidgetScale>
    );
    expect(content.parentElement).toHaveStyle({
      width: '200%',
      height: '200%',
      transform: 'scale(0.5)',
    });
    // Changing scale preserves the mounted widget and any state it holds.
    expect(screen.getByTestId('content')).toBe(content);
    expect(content.parentElement?.parentElement).toBe(frame);
  });

  it('gives nested widgets an independent scale', () => {
    render(
      <WidgetScale scale={200}>
        <WidgetScale scale={150}>
          <div data-testid="panel" />
        </WidgetScale>
        <WidgetScale>
          <div data-testid="default-panel" />
        </WidgetScale>
      </WidgetScale>
    );
    expect(screen.getByTestId('panel').parentElement).toHaveStyle({
      transform: 'scale(0.75)',
    });
    expect(screen.getByTestId('default-panel').parentElement).toHaveStyle({
      transform: 'scale(0.5)',
      width: '200%',
      height: '200%',
    });
  });
});
