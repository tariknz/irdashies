import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

const renderTooltip = (content = 'Explains the control') =>
  render(
    <Tooltip content={content}>
      <button>Trigger</button>
    </Tooltip>
  );

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows on hover only after the open delay', () => {
    renderTooltip();
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Explains the control'
    );
    expect(trigger).toHaveAttribute(
      'aria-describedby',
      screen.getByRole('tooltip').id
    );
  });

  it('hides again on mouse leave', () => {
    renderTooltip();
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows immediately on keyboard focus', () => {
    renderTooltip();

    fireEvent.focus(screen.getByRole('button'));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides on Escape', () => {
    renderTooltip();
    const trigger = screen.getByRole('button');

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the handlers already on the trigger', () => {
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    render(
      <Tooltip content="Pins this driver">
        <button onMouseEnter={onMouseEnter} onFocus={onFocus}>
          Trigger
        </button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(trigger);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
