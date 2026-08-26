import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitPane } from './SplitPane';

const CONTAINER_WIDTH = 1000;
const STORAGE_KEY = 'testSplitPercent';

const renderSplit = (props?: Partial<Parameters<typeof SplitPane>[0]>) =>
  render(
    <SplitPane
      label="Test split"
      storageKey={STORAGE_KEY}
      left={<div>left pane</div>}
      right={<div>right pane</div>}
      {...props}
    />
  );

const divider = () => screen.getByRole('separator');

/** Left pane sits immediately before the divider. */
const leftPane = () => screen.getByText('left pane').parentElement;

const drag = (toClientX: number) => {
  const handle = divider();
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, isPrimary: true });
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: toClientX,
    buttons: 1,
  });
  fireEvent.pointerUp(handle, { pointerId: 1 });
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: CONTAINER_WIDTH,
    bottom: 500,
    width: CONTAINER_WIDTH,
    height: 500,
    toJSON: () => ({}),
  } as DOMRect);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SplitPane', () => {
  it('opens at an even split', () => {
    renderSplit();

    expect(divider()).toHaveAttribute('aria-valuenow', '50');
    expect(leftPane()).toHaveStyle({ flexBasis: '50%' });
  });

  it('resizes to where the pointer is dragged', () => {
    renderSplit();

    drag(700);

    expect(divider()).toHaveAttribute('aria-valuenow', '70');
    expect(leftPane()).toHaveStyle({ flexBasis: '70%' });
  });

  it('clamps a drag past either end to the minimum pane width', () => {
    renderSplit({ minPercent: 15 });

    drag(20);
    expect(divider()).toHaveAttribute('aria-valuenow', '15');

    drag(990);
    expect(divider()).toHaveAttribute('aria-valuenow', '85');
  });

  it('remembers the ratio and reads it back', () => {
    const { unmount } = renderSplit();

    drag(300);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('30');

    unmount();
    renderSplit();

    expect(divider()).toHaveAttribute('aria-valuenow', '30');
  });

  it('ignores a stored ratio that is not a number', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-number');

    renderSplit();

    expect(divider()).toHaveAttribute('aria-valuenow', '50');
  });

  it('nudges with the arrow keys and resets with Home', () => {
    renderSplit();

    fireEvent.keyDown(divider(), { key: 'ArrowRight' });
    expect(divider()).toHaveAttribute('aria-valuenow', '52');

    fireEvent.keyDown(divider(), { key: 'ArrowLeft' });
    fireEvent.keyDown(divider(), { key: 'ArrowLeft' });
    expect(divider()).toHaveAttribute('aria-valuenow', '48');

    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(divider()).toHaveAttribute('aria-valuenow', '50');
  });

  it('resets on a double click', () => {
    renderSplit({ defaultPercent: 60 });

    drag(300);
    fireEvent.doubleClick(divider());

    expect(divider()).toHaveAttribute('aria-valuenow', '60');
  });

  it('does not drag on a non-primary button', () => {
    renderSplit();

    const handle = divider();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 2, isPrimary: true });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 800, buttons: 2 });

    expect(divider()).toHaveAttribute('aria-valuenow', '50');
  });

  it('ignores a second pointer during an active drag', () => {
    renderSplit();

    const handle = divider();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, buttons: 1 });

    // A second finger on the divider must not steer it...
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 200, buttons: 1 });
    expect(divider()).toHaveAttribute('aria-valuenow', '70');

    // ...nor end the first pointer's drag.
    fireEvent.pointerUp(handle, { pointerId: 2 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, buttons: 1 });
    expect(divider()).toHaveAttribute('aria-valuenow', '40');

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('40');
  });

  it('stops dragging when the pointer capture is lost', () => {
    renderSplit();

    const handle = divider();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, buttons: 1 });
    fireEvent.lostPointerCapture(handle, { pointerId: 1 });

    // A stray move with no button held must not keep resizing.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 200, buttons: 0 });

    expect(divider()).toHaveAttribute('aria-valuenow', '70');
  });

  it('persists the latest ratio when the final move and release land in the same batch', () => {
    renderSplit();

    const handle = divider();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, isPrimary: true });

    // Nesting inside one act() defers the re-render from pointermove until
    // after pointerup has also run, so pointerup sees stale React state if
    // it isn't reading the ratio from a ref.
    act(() => {
      fireEvent.pointerMove(handle, {
        pointerId: 1,
        clientX: 700,
        buttons: 1,
      });
      fireEvent.pointerUp(handle, { pointerId: 1 });
    });

    expect(divider()).toHaveAttribute('aria-valuenow', '70');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('70');
  });
});
