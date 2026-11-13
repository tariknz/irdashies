import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WidgetLayout } from '@irdashies/types';
import { WidgetContainer } from './WidgetContainer';

const dashboard = vi.hoisted(() => ({
  containerBoundsInfo: null as unknown,
  currentDashboard: undefined as unknown,
}));

vi.mock('@irdashies/context', () => ({
  useContainerOffset: () => ({ x: 0, y: 0 }),
  useDashboard: () => dashboard,
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

describe('WidgetContainer center line', () => {
  const DISPLAY = { x: 0, y: 0, width: 1920, height: 1080 };
  const guide = () => screen.queryByTestId('center-guide');
  const position = () =>
    (document.querySelector('[data-widget-id="standings"]') as HTMLElement)
      .style.transform;

  /** A 400px-wide widget at x=100, its right edge 460px left of the middle. */
  const renderWidget = (siblingLayouts?: WidgetLayout[]) =>
    render(
      <WidgetContainer
        widget={{
          id: 'standings',
          enabled: true,
          layout: { x: 100, y: 40, width: 400, height: 300 },
        }}
        siblingLayouts={siblingLayouts}
        editMode
        zIndex={1}
        onLayoutChange={vi.fn()}
      >
        <div>Standings content</div>
      </WidgetContainer>
    );

  const grab = () =>
    fireEvent.pointerDown(screen.getByText('Standings'), {
      clientX: 0,
      clientY: 0,
    });
  const dragTo = (clientX: number, init: PointerEventInit = {}) =>
    fireEvent.pointerMove(window, { clientX, clientY: 0, ...init });
  const release = () => fireEvent.pointerUp(window);

  afterEach(() => {
    dashboard.containerBoundsInfo = null;
    dashboard.currentDashboard = undefined;
    delete window.rendererPerfBridge;
  });

  it('shows the middle once an edge comes near it, until the button is released', () => {
    dashboard.containerBoundsInfo = {
      expected: DISPLAY,
      displayBounds: DISPLAY,
    };
    renderWidget();
    grab();

    dragTo(300);
    expect(guide()).toBeNull();

    // Right edge at 950, 10px short of the middle.
    dragTo(450);
    expect(guide()).toHaveStyle({
      left: '960px',
      top: '0px',
      height: '1080px',
    });

    // Moved well away: the line stays for the rest of the drag.
    dragTo(0);
    expect(guide()).not.toBeNull();

    release();
    expect(guide()).toBeNull();
  });

  it("snaps the widget's center onto the middle, unless Shift is held", () => {
    dashboard.containerBoundsInfo = {
      expected: DISPLAY,
      displayBounds: DISPLAY,
    };
    renderWidget();
    grab();

    // Center at 965, 5px past the middle.
    dragTo(665);
    expect(position()).toBe('translate(760px, 40px)');
    expect(guide()).not.toBeNull();

    dragTo(665, { shiftKey: true });
    expect(position()).toBe('translate(765px, 40px)');
    release();
  });

  it('ends the drag when the pointer is cancelled', () => {
    dashboard.containerBoundsInfo = {
      expected: DISPLAY,
      displayBounds: DISPLAY,
    };
    renderWidget();
    grab();
    dragTo(450);
    expect(guide()).not.toBeNull();

    fireEvent.pointerCancel(window);
    expect(guide()).toBeNull();
    // Moves after a cancel, button up, no longer carry the widget.
    dragTo(665);
    expect(position()).toBe('translate(550px, 40px)');
  });

  it('keeps no grid edge lock taken while the center snap held the widget', () => {
    dashboard.containerBoundsInfo = {
      expected: DISPLAY,
      displayBounds: DISPLAY,
    };
    dashboard.currentDashboard = {
      generalSettings: { editMode: { snapToGrid: true } },
    };
    // A neighbour whose left edge is 4px inside the widget's right edge
    // while the widget's center is 8px short of the middle.
    renderWidget([{ x: 1148, y: 40, width: 300, height: 300 }]);
    grab();

    // Raw x 752: centered at 760, while the grid locks the right edge to
    // the neighbour underneath.
    dragTo(652);
    expect(position()).toBe('translate(760px, 40px)');

    // A quick move left, out of the center snap: the widget follows the
    // grid, not that lock (which would hold it at 748).
    dragTo(642);
    expect(position()).toBe('translate(740px, 40px)');
    release();
  });

  it('measures each move of a drag for the perf overlay', () => {
    const recordMeasure = vi.fn();
    window.rendererPerfBridge = { recordMeasure };
    dashboard.containerBoundsInfo = {
      expected: DISPLAY,
      displayBounds: DISPLAY,
    };
    renderWidget();
    grab();
    dragTo(300);
    dragTo(310);
    release();

    expect(recordMeasure).toHaveBeenCalledTimes(2);
    expect(recordMeasure).toHaveBeenCalledWith(
      'widgetDrag',
      expect.any(Number)
    );
  });

  it('saves a dragged position in whole pixels', () => {
    renderWidget();
    grab();
    // A scaled display moves the pointer in fractions of a pixel.
    dragTo(100.4);
    expect(position()).toBe('translate(200px, 40px)');
    release();
  });

  it('shows nothing before the display is known', () => {
    renderWidget();
    grab();
    dragTo(665);
    expect(guide()).toBeNull();
    expect(position()).toBe('translate(765px, 40px)');
    release();
  });
});
