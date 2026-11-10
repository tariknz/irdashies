import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  HERO_HOLD_MS,
  LAST_CORNER_UNAVAILABLE_TEXT,
  LastCornerPanel,
  type LastCornerPanelEntry,
} from './LastCornerPanel';

const entry = (
  overrides: Partial<LastCornerPanelEntry> = {}
): LastCornerPanelEntry => ({
  sectionId: 'turn-5',
  label: 'T5',
  timeDeltaSec: -0.14,
  brakePointDeltaM: -7,
  apexSpeedDelta: 2.4,
  ...overrides,
});

const defaultProps = {
  entries: [entry()],
  count: 1,
  placement: 'bottom' as const,
  speedUnit: 'km/h' as const,
  showTime: true,
  showBrakeDelta: true,
  showApexSpeed: true,
};

/** The element carrying the delta colour is the span wrapping the number. */
const colourOf = (text: string) =>
  screen.getByText(text).closest('span')?.className ?? '';

const panel = () => screen.getByTestId('last-corner-panel');

/** The row is the fontSize-carrying div — the immediate parent of the label span. */
const rowOf = (label: string) =>
  screen.getByText(label).closest('div') as HTMLDivElement;

/** Hero rows carry data-hero; history rows do not. */
const isHero = (label: string) => rowOf(label).dataset.hero === 'true';

describe('LastCornerPanel', () => {
  afterEach(cleanup);

  it('colours a faster corner green', () => {
    render(<LastCornerPanel {...defaultProps} />);

    expect(colourOf('-0.14')).toContain('text-green-400');
  });

  it('colours a slower corner red and forces the plus sign', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ timeDeltaSec: 0.22 })]}
      />
    );

    expect(screen.getByText('+0.22')).toBeTruthy();
    expect(colourOf('+0.22')).toContain('text-red-400');
  });

  it('colours more apex speed green and less red', () => {
    const { rerender } = render(<LastCornerPanel {...defaultProps} />);
    expect(colourOf('+2.4')).toContain('text-green-400');

    rerender(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ apexSpeedDelta: -1.8 })]}
      />
    );
    expect(colourOf('-1.8')).toContain('text-red-400');
  });

  it('keeps green meaning "better" even when both signs are positive', () => {
    // The polarity trap: slower through the corner (+, red) while carrying more
    // apex speed (+, green), side by side. Colour is the invariant — this is the
    // guard against anyone "fixing" the sign inconsistency.
    render(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ timeDeltaSec: 0.22, apexSpeedDelta: 2.4 })]}
      />
    );

    expect(colourOf('+0.22')).toContain('text-red-400');
    expect(colourOf('+2.4')).toContain('text-green-400');
  });

  it('colours braking later than the reference green and earlier red', () => {
    const { rerender } = render(<LastCornerPanel {...defaultProps} />);
    expect(colourOf('-7')).toContain('text-red-400');

    rerender(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ brakePointDeltaM: 7 })]}
      />
    );
    expect(screen.getByText('+7')).toBeTruthy();
    expect(colourOf('+7')).toContain('text-green-400');
  });

  it('hides only the metric that is switched off', () => {
    const { rerender } = render(
      <LastCornerPanel {...defaultProps} showTime={false} />
    );
    expect(screen.queryByText('-0.14')).toBeNull();
    expect(screen.getByText('-7')).toBeTruthy();
    expect(screen.getByText('+2.4')).toBeTruthy();

    rerender(<LastCornerPanel {...defaultProps} showBrakeDelta={false} />);
    expect(screen.getByText('-0.14')).toBeTruthy();
    expect(screen.queryByText('-7')).toBeNull();
    expect(screen.getByText('+2.4')).toBeTruthy();

    rerender(<LastCornerPanel {...defaultProps} showApexSpeed={false} />);
    expect(screen.getByText('-0.14')).toBeTruthy();
    expect(screen.getByText('-7')).toBeTruthy();
    expect(screen.queryByText('+2.4')).toBeNull();
  });

  it('renders every configured slot even with no history yet', () => {
    render(<LastCornerPanel {...defaultProps} entries={[]} count={3} />);

    // Sizing to the history it happens to hold would resize the trace beside it
    // every time a corner completed.
    expect(panel().children).toHaveLength(3);
    expect(screen.queryByText('-0.14')).toBeNull();
  });

  it('says the corners are not available, in the box the rows would fill', () => {
    render(
      <LastCornerPanel {...defaultProps} entries={[]} count={3} unavailable />
    );

    expect(screen.getByText(LAST_CORNER_UNAVAILABLE_TEXT)).toBeTruthy();
    expect(panel().children).toHaveLength(1);
    // The same size as the three rows, so the trace beside it stays put.
    expect(panel().style.height).toBe(`${3 * (16 + 2)}px`);
  });

  it('pads a partial history up to the configured count', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry(), entry({ sectionId: 'turn-4', label: 'T4' })]}
        count={4}
      />
    );

    expect(panel().children).toHaveLength(4);
    expect(screen.getByText('T5')).toBeTruthy();
    expect(screen.getByText('T4')).toBeTruthy();
  });

  it('shows the label but no deltas for the corner being driven', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        count={2}
        entries={[
          entry({
            sectionId: 'turn-6',
            label: 'T6',
            timeDeltaSec: null,
            brakePointDeltaM: null,
            apexSpeedDelta: null,
          }),
          entry(),
        ]}
      />
    );

    expect(screen.getByText('T6')).toBeTruthy();
    // The corner in progress holds its slot without showing a number.
    expect(screen.getByText('-0.14')).toBeTruthy();
    expect(screen.queryByText('+0.00')).toBeNull();
  });

  it('shows time and apex-speed even when the brake-point pairing failed', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ brakePointDeltaM: null })]}
      />
    );

    expect(screen.getByText('-0.14')).toBeTruthy();
    expect(screen.getByText('+2.4')).toBeTruthy();
  });

  it('keeps an empty brake column aligned with the following delta', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        count={2}
        entries={[
          entry({ brakePointDeltaM: null }),
          entry({ label: 'T4', brakePointDeltaM: 5 }),
        ]}
      />
    );

    const historyRow = screen.getByText('T4').closest('div') as HTMLDivElement;
    expect(historyRow.style.gridTemplateColumns).toBe(
      '3.5em 4.7em 4.5em 6.2em'
    );
    expect(historyRow.children).toHaveLength(4);
  });

  it('renders history columns in the configured order', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        count={2}
        displayOrder={[
          'corner',
          'apexSpeedDelta',
          'cornerTimeDelta',
          'brakePointDelta',
        ]}
        entries={[entry(), entry({ label: 'T4' })]}
      />
    );

    const historyRow = screen.getByText('T4').closest('div') as HTMLDivElement;
    expect(historyRow.style.gridTemplateColumns).toBe(
      '3.5em 6.2em 4.7em 4.5em'
    );
    expect(historyRow.children[1].textContent).toContain('+2.4');
    expect(historyRow.children[2].textContent).toContain('-0.14');
  });

  it('gives every corner its own line, whatever the placement', () => {
    const { rerender } = render(<LastCornerPanel {...defaultProps} />);
    expect(panel().className).toContain('flex-col');
    expect(panel().dataset.placement).toBe('bottom');

    rerender(<LastCornerPanel {...defaultProps} placement="right" />);
    expect(panel().className).toContain('flex-col');
    expect(panel().dataset.placement).toBe('right');
  });

  it('clips rather than growing past the room it is given', () => {
    render(<LastCornerPanel {...defaultProps} count={5} />);

    // Whatever is left over is dropped from the bottom, which is the oldest.
    expect(panel().className).toContain('overflow-hidden');
  });

  it('gives a side column a fixed width that tracks the text size', () => {
    const { rerender } = render(
      <LastCornerPanel {...defaultProps} placement="right" fontSize={10} />
    );
    const narrow = parseFloat(panel().style.width);
    expect(narrow).toBeGreaterThan(0);

    rerender(
      <LastCornerPanel {...defaultProps} placement="right" fontSize={20} />
    );
    expect(parseFloat(panel().style.width)).toBeGreaterThan(narrow);
  });

  it('narrows the side column when fewer metrics are shown', () => {
    const { rerender } = render(
      <LastCornerPanel {...defaultProps} placement="right" fontSize={10} />
    );
    const allThree = parseFloat(panel().style.width);

    rerender(
      <LastCornerPanel
        {...defaultProps}
        placement="right"
        fontSize={10}
        showTime={false}
        showApexSpeed={false}
      />
    );
    const single = parseFloat(panel().style.width);
    expect(single).toBeGreaterThan(0);
    expect(single).toBeLessThan(allThree);
  });

  it('keeps the single-metric width proportional to the font (small font)', () => {
    const single = {
      ...defaultProps,
      placement: 'right' as const,
      showTime: false,
      showApexSpeed: false,
    };
    const { rerender } = render(<LastCornerPanel {...single} fontSize={8} />);
    const small = parseFloat(panel().style.width);
    expect(small).toBeGreaterThan(0);

    rerender(<LastCornerPanel {...single} fontSize={24} />);
    // Same single metric, 3x the font → the column grows with it.
    expect(parseFloat(panel().style.width)).toBeGreaterThan(small * 2);
  });

  it('pins its own size in every placement, never bigger than its box', () => {
    // Sized to its content, the box it sits in shrank as it dropped rows and
    // columns, and they never came back when the widget grew.
    for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
      const { unmount } = render(
        <LastCornerPanel {...defaultProps} count={3} placement={placement} />
      );
      expect(parseFloat(panel().style.width)).toBeGreaterThan(0);
      // Three one-line rows at 10px, each with the gap after it.
      expect(panel().style.height).toBe(`${3 * (16 + 2)}px`);
      expect(panel().style.maxWidth).toBe('100%');
      expect(panel().style.maxHeight).toBe('100%');
      unmount();
    }
  });

  it('puts the newest corner and all its deltas on one row', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        count={2}
        entries={[
          entry({ sectionId: 'a', label: 'T5' }),
          entry({ sectionId: 'b', label: 'T4' }),
        ]}
      />
    );

    const heroRow = rowOf('T5');
    expect(isHero('T5')).toBe(true);
    expect(isHero('T4')).toBe(false);

    // Name and every delta share one grid row, laid out on the same columns
    // the history below uses, rather than stacking the name above them.
    expect(heroRow.style.gridTemplateColumns).toBe('3.5em 4.7em 4.5em 6.2em');
    expect(heroRow.children).toHaveLength(4);
    expect(heroRow.textContent).toContain('T5');
    expect(heroRow.textContent).toContain('-0.14');
    expect(heroRow.textContent).toContain('-7');
    expect(heroRow.textContent).toContain('+2.4');
  });

  it('marks the newest corner apart from the history it sits above', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        count={2}
        entries={[
          entry({ sectionId: 'a', label: 'T5' }),
          entry({ sectionId: 'b', label: 'T4' }),
        ]}
      />
    );

    expect(screen.getByText('T5').className).toContain('font-bold');
    expect(screen.getByText('T4').className).not.toContain('font-bold');
  });

  it('drops the oldest lines when there is not room for them all', () => {
    // jsdom reports zero heights, so drive the measurement directly. The hero
    // is a single row like the rest, so it plus one compact row is the room
    // given here — enough for the newest two, not the third.
    const fontSize = 10;
    const rowHeight = Math.round(fontSize * 1.6) + 2;
    const heroHeight = Math.round(fontSize * 1.6) + 2;
    const observers: (() => void)[] = [];
    class FakeResizeObserver {
      constructor(private cb: () => void) {
        observers.push(cb);
      }
      observe() {
        /* measurement is driven by the clientHeight stub below */
      }
      disconnect() {
        /* no teardown needed for the stub */
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(heroHeight + rowHeight);

    try {
      render(
        <LastCornerPanel
          {...defaultProps}
          fontSize={fontSize}
          count={5}
          entries={[
            entry({ sectionId: 'a', label: 'T5' }),
            entry({ sectionId: 'b', label: 'T4' }),
            entry({ sectionId: 'c', label: 'T3' }),
          ]}
        />
      );

      expect(panel().children).toHaveLength(2);
      // Newest survive; the oldest is the one dropped.
      expect(screen.getByText('T5')).toBeTruthy();
      expect(screen.getByText('T4')).toBeTruthy();
      expect(screen.queryByText('T3')).toBeNull();
    } finally {
      clientHeight.mockRestore();
      vi.unstubAllGlobals();
      observers.length = 0;
    }
  });

  describe('in less width than its columns need', () => {
    // jsdom lays nothing out, so drive the measurement: a ResizeObserver that
    // only lets the panel measure once, and the width a layout gave it.
    const measured = (width: number, panel: React.ReactElement) => {
      class FakeResizeObserver {
        observe() {
          /* measurement is driven by the size stubs below */
        }
        disconnect() {
          /* no teardown needed for the stub */
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      const clientWidth = vi
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(width);
      const clientHeight = vi
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockReturnValue(500);
      try {
        render(panel);
      } finally {
        clientWidth.mockRestore();
        clientHeight.mockRestore();
        vi.unstubAllGlobals();
      }
    };
    // 'T5' takes the 3.5em minimum name column. At the 10px history size the
    // name and the time delta need 3.5 + 0.3 + 4.7 = 8.5em, 85px; adding the
    // brake delta needs 133px.
    const props = {
      ...defaultProps,
      placement: 'right' as const,
      fontSize: 10,
      latestScale: 1.4,
    };

    it('draws the columns that fit, dropping from the end of the order', () => {
      measured(100, <LastCornerPanel {...props} />);
      expect(screen.getByText('-0.14')).toBeTruthy();
      // Gone whole, not drawn half hidden behind the trace.
      expect(screen.queryByText('-7')).toBeNull();
      expect(screen.queryByText('+2.4')).toBeNull();
    });

    it('follows the configured order when it drops a column', () => {
      // Apex speed first: name and apex need 3.5 + 0.3 + 6.2 = 10em, which
      // fits 100px exactly, and the time delta behind it goes.
      measured(
        100,
        <LastCornerPanel
          {...props}
          displayOrder={[
            'corner',
            'apexSpeedDelta',
            'cornerTimeDelta',
            'brakePointDelta',
          ]}
        />
      );
      expect(screen.getByText('+2.4')).toBeTruthy();
      expect(screen.queryByText('-0.14')).toBeNull();
    });

    it('draws the newest corner smaller before it loses a column', () => {
      measured(100, <LastCornerPanel {...props} />);
      // 14px would need 119px for name and time; it gives up its extra size
      // to fit 100px, and keeps the time delta the history shows.
      const heroSize = parseFloat(rowOf('T5').style.fontSize);
      expect(heroSize).toBeLessThan(14);
      expect(heroSize).toBeGreaterThanOrEqual(10);
    });

    it('always keeps the corner name', () => {
      measured(20, <LastCornerPanel {...props} />);
      expect(screen.getByText('T5')).toBeTruthy();
      expect(screen.queryByText('-0.14')).toBeNull();
      // Never below the history size.
      expect(parseFloat(rowOf('T5').style.fontSize)).toBe(10);
    });

    it('keeps its width sized for every column, so the box it measures stays put', () => {
      measured(100, <LastCornerPanel {...props} />);
      // 19.8em at the 14px newest-row size, whatever is drawn inside, and
      // rounded up so it always holds every column.
      expect(panel().style.width).toBe(`${Math.ceil(14 * 19.8)}px`);
      expect(panel().style.maxWidth).toBe('100%');
    });

    it('keeps every column when given exactly its own width', () => {
      // A layout with room to spare gives the panel the width it asks for.
      // At 13px with no emphasis on the newest row that is 19.8em, 257.4px:
      // rounded down to 257 and compared exactly, it dropped the apex speed
      // with nothing constraining it. Float error did the same at 14px.
      for (let fontSize = 8; fontSize <= 24; fontSize += 1) {
        const sized = { ...props, fontSize, latestScale: 1 };
        const { unmount } = render(<LastCornerPanel {...sized} />);
        const ownWidth = parseFloat(panel().style.width);
        unmount();

        measured(ownWidth, <LastCornerPanel {...sized} />);
        expect(screen.getByText('+2.4')).toBeTruthy();
        cleanup();
      }
    });

    it('keeps one measurement running as its room changes, and gets columns and rows back', () => {
      let created = 0;
      let resized = () => {
        /* replaced by the observer's callback */
      };
      class FakeResizeObserver {
        constructor(callback: () => void) {
          created += 1;
          resized = callback;
        }
        observe() {
          /* measurement is driven by the size stubs below */
        }
        disconnect() {
          /* no teardown needed for the stub */
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      let width = 400;
      let height = 500;
      const clientWidth = vi
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockImplementation(() => width);
      const clientHeight = vi
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockImplementation(() => height);
      const threeCorners = [
        entry({ sectionId: 'a', label: 'T5' }),
        entry({ sectionId: 'b', label: 'T4' }),
        entry({ sectionId: 'c', label: 'T3' }),
      ];
      try {
        render(<LastCornerPanel {...props} count={3} entries={threeCorners} />);
        const ownSize = [panel().style.width, panel().style.height];
        expect(screen.getAllByText('-7')).toHaveLength(3);

        // Squeezed both ways: the newest row shrinks, a column and a row go.
        width = 100;
        height = 30;
        act(() => resized());
        expect(screen.queryByText('-7')).toBeNull();
        expect(panel().children).toHaveLength(1);
        // Its own size does not follow what it draws, so its box can grow
        // back; and changing the newest row's size did not restart the
        // measurement.
        expect([panel().style.width, panel().style.height]).toEqual(ownSize);
        expect(created).toBe(1);

        width = 400;
        height = 500;
        act(() => resized());
        expect(screen.getAllByText('-7')).toHaveLength(3);
        expect(created).toBe(1);
      } finally {
        clientWidth.mockRestore();
        clientHeight.mockRestore();
        vi.unstubAllGlobals();
      }
    });
  });

  it('scales the text to the configured size', () => {
    const { rerender } = render(
      <LastCornerPanel {...defaultProps} fontSize={10} />
    );
    expect(panel().style.fontSize).toBe('10px');

    rerender(<LastCornerPanel {...defaultProps} fontSize={20} />);
    expect(panel().style.fontSize).toBe('20px');
  });

  it('falls back to the default size when none is configured', () => {
    render(<LastCornerPanel {...defaultProps} />);

    expect(panel().style.fontSize).toBe('10px');
  });

  it('renders the configured speed unit', () => {
    const { rerender } = render(<LastCornerPanel {...defaultProps} />);
    expect(screen.getByText('km/h')).toBeTruthy();

    rerender(<LastCornerPanel {...defaultProps} speedUnit="mph" />);
    expect(screen.getByText('mph')).toBeTruthy();
  });

  it('shows the corner label', () => {
    render(
      <LastCornerPanel
        {...defaultProps}
        entries={[entry({ label: 'Eau Rouge' })]}
      />
    );

    expect(screen.getByText('Eau Rouge')).toBeTruthy();
  });

  describe('column sizing', () => {
    it('clips a delta rather than letting it run into the next column', () => {
      render(<LastCornerPanel {...defaultProps} count={2} />);

      const row = rowOf('T5');
      // The apex chip is the widest of the three ("km/h" is most of a column
      // on its own) and is not the last column in every configured order, so
      // an overlong value there is what used to paint over its neighbour.
      const apexCell = row.children[3] as HTMLElement;
      expect(apexCell.className).toContain('overflow-hidden');
      expect(apexCell.className).toContain('min-w-0');

      const chip = screen.getByText('+2.4').closest('span') as HTMLElement;
      expect(chip.className).toContain('whitespace-nowrap');
    });

    it('gives apex speed more room than the narrower deltas', () => {
      render(<LastCornerPanel {...defaultProps} />);

      const [, time, brake, apex] = rowOf('T5')
        .style.gridTemplateColumns.split(' ')
        .map(parseFloat);
      expect(apex).toBeGreaterThan(time);
      expect(apex).toBeGreaterThan(brake);
    });

    it('drops the column of a metric that is switched off', () => {
      render(
        <LastCornerPanel
          {...defaultProps}
          showTime={false}
          showApexSpeed={false}
        />
      );

      // Not an empty reserved column: a metric that is off gives its width
      // back, which is the whole point of switching it off beside the trace.
      expect(rowOf('T5').style.gridTemplateColumns).toBe('3.5em 4.5em');
      expect(rowOf('T5').children).toHaveLength(2);
    });

    it("sizes the name column to the track's own corner names", () => {
      const { rerender } = render(
        <LastCornerPanel
          {...defaultProps}
          placement="right"
          fontSize={10}
          cornerLabels={['T1', 'T2', 'T3']}
        />
      );
      const numbered = parseFloat(panel().style.width);

      rerender(
        <LastCornerPanel
          {...defaultProps}
          placement="right"
          fontSize={10}
          cornerLabels={['Variante Tamburello A', 'Rivazza']}
        />
      );
      // A numbered circuit must not be padded out to fit the longest name a
      // named circuit could have.
      expect(numbered).toBeLessThan(parseFloat(panel().style.width));
    });

    it('holds that width as the history fills up', () => {
      const named = ['Variante Tamburello A', 'Rivazza'];
      const { rerender } = render(
        <LastCornerPanel
          {...defaultProps}
          count={3}
          placement="right"
          fontSize={10}
          cornerLabels={named}
          entries={[entry({ label: 'Rivazza' })]}
        />
      );
      const withShortName = parseFloat(panel().style.width);

      rerender(
        <LastCornerPanel
          {...defaultProps}
          count={3}
          placement="right"
          fontSize={10}
          cornerLabels={named}
          entries={[
            entry({ sectionId: 'a', label: 'Variante Tamburello A' }),
            entry({ sectionId: 'b', label: 'Rivazza' }),
          ]}
        />
      );

      // The longest corner on the track arriving must not widen the panel and
      // shove the trace sideways mid-lap.
      expect(parseFloat(panel().style.width)).toBe(withShortName);
    });

    it('falls back to the entries when the track corners are unknown', () => {
      // Stories and tests render rows without a circuit behind them; the
      // column still has to be wide enough for what it is showing.
      render(
        <LastCornerPanel
          {...defaultProps}
          placement="right"
          fontSize={10}
          entries={[entry({ label: 'Variante Tamburello A' })]}
        />
      );

      expect(rowOf('Variante Tamburello A').style.gridTemplateColumns).toBe(
        '9em 4.7em 4.5em 6.2em'
      );
    });

    it('grows the width in step with the hero size, not faster', () => {
      const { rerender } = render(
        <LastCornerPanel {...defaultProps} placement="right" fontSize={10} />
      );
      const unscaled = parseFloat(panel().style.width);

      rerender(
        <LastCornerPanel
          {...defaultProps}
          placement="right"
          fontSize={10}
          latestScale={1.5}
        />
      );
      // Half again as big a hero costs half again as much width, and no more
      // — the column carries no slack that the scale could multiply. Within a
      // pixel, since both ends are rounded to whole pixels.
      const scaled = parseFloat(panel().style.width);
      expect(Math.abs(scaled - unscaled * 1.5)).toBeLessThanOrEqual(1);
    });
  });

  describe('retiring the hero', () => {
    const withClock = (label: string, completedAt: number) =>
      entry({ sectionId: label.toLowerCase(), label, completedAt });

    it('drops the newest corner into the history rows after five seconds', () => {
      vi.useFakeTimers();
      try {
        const now = Date.now();
        render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            entries={[withClock('T5', now), withClock('T4', now - 20_000)]}
          />
        );

        // Still the hero.
        expect(isHero('T5')).toBe(true);

        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS);
        });

        // Now a compact history row, and the hero slot is left empty.
        expect(isHero('T5')).toBe(false);
        expect(isHero('T4')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps the same number of slots when it fires', () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            entries={[withClock('T5', Date.now())]}
          />
        );
        const before = container.querySelectorAll('[style*="height"]').length;

        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS);
        });

        // The slot keeps its space, so a top/bottom panel never nudges the
        // trace when the timer fires.
        expect(container.querySelectorAll('[style*="height"]')).toHaveLength(
          before
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('restarts the hold when a newer corner arrives', () => {
      vi.useFakeTimers();
      try {
        const { rerender } = render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            entries={[withClock('T4', Date.now())]}
          />
        );

        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS - 1000);
        });
        rerender(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            entries={[withClock('T5', Date.now()), withClock('T4', Date.now())]}
          />
        );

        // The new corner gets the full hold, not what was left of T4's.
        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS - 1000);
        });
        expect(isHero('T5')).toBe(true);

        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(isHero('T5')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('retires a corner that was already stale when it first rendered', () => {
      vi.useFakeTimers();
      try {
        render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            entries={[withClock('T5', Date.now() - HERO_HOLD_MS - 1)]}
          />
        );

        expect(isHero('T5')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('holds the corner indefinitely with only one slot to show it in', () => {
      // Retiring it there would leave the panel rendering nothing at all,
      // which reads as broken rather than as "that was a while ago".
      vi.useFakeTimers();
      try {
        render(
          <LastCornerPanel
            {...defaultProps}
            count={1}
            entries={[withClock('T5', Date.now())]}
          />
        );

        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS * 4);
        });

        expect(screen.getByText('T5')).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('never retires an entry that carries no clock', () => {
      // Stories and fixed-row tests have no completedAt, and should render
      // exactly as they always have.
      vi.useFakeTimers();
      try {
        render(<LastCornerPanel {...defaultProps} count={3} />);

        act(() => {
          vi.advanceTimersByTime(HERO_HOLD_MS * 4);
        });

        expect(isHero('T5')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('corner-name sizing', () => {
    const twoRows = {
      ...defaultProps,
      count: 2,
      fontSize: 10,
      entries: [
        entry({ sectionId: 'a', label: 'Variante Tamburello A' }),
        entry({ sectionId: 'b', label: 'Acque Minerali B' }),
      ],
    };

    it('keeps a short name on one line', () => {
      render(<LastCornerPanel {...twoRows} />);

      const label = screen.getByText('Acque Minerali B');
      expect(label.className).toContain('truncate');
      expect(label.className).not.toContain('line-clamp-2');
    });

    it('wraps only a long name onto a second line', () => {
      render(<LastCornerPanel {...twoRows} />);

      const label = screen.getByText('Variante Tamburello A');
      expect(label.className).toContain('line-clamp-2');
      // A single long word has to wrap too, not overflow the column.
      expect(label.className).toContain('break-words');
    });

    it('sizes each row to the label it contains', () => {
      render(<LastCornerPanel {...twoRows} />);

      // Two lines for the wrapped name, one for the short one — the hero is
      // no taller than the name it holds now that its deltas share the row.
      expect(rowOf('Variante Tamburello A').style.height).toBe('25px');
      expect(rowOf('Acque Minerali B').style.height).toBe('16px');
    });

    it('fits rows using each label height', () => {
      // jsdom reports zero heights, so drive the measurement directly — the
      // same stub the other fit tests use. This is exactly the room three
      // one-line rows need.
      const fontSize = 10;
      class FakeResizeObserver {
        observe() {
          /* measurement is driven by the clientHeight stub below */
        }
        disconnect() {
          /* no teardown needed for the stub */
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      const clientHeight = vi
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockReturnValue(25 + 2 + (16 + 2));

      try {
        const entries = [
          entry({ sectionId: 'a', label: 'Variante Tamburello A' }),
          entry({ sectionId: 'b', label: 'Acque Minerali B' }),
          entry({ sectionId: 'c', label: 'GRESINI A' }),
        ];
        const { rerender } = render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            fontSize={fontSize}
            entries={entries}
          />
        );
        expect(screen.queryByText('GRESINI A')).toBeNull();

        rerender(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            fontSize={fontSize}
            entries={entries}
          />
        );
        expect(screen.getByText('Variante Tamburello A')).toBeTruthy();
        // The long hero plus one short row fit, but the next row does not.
        expect(screen.queryByText('GRESINI A')).toBeNull();
      } finally {
        clientHeight.mockRestore();
        vi.unstubAllGlobals();
      }
    });
  });

  describe('latestScale', () => {
    it('draws the newest corner bigger than the rest', () => {
      render(
        <LastCornerPanel
          {...defaultProps}
          count={2}
          fontSize={10}
          latestScale={1.5}
          entries={[
            entry({ sectionId: 'a', label: 'T5' }),
            entry({ sectionId: 'b', label: 'T4' }),
          ]}
        />
      );

      expect(rowOf('T5').style.fontSize).toBe('15px');
      expect(rowOf('T4').style.fontSize).toBe('10px');
      // The panel container itself stays at the base size — only the row
      // that needs to differ carries its own override.
      expect(panel().style.fontSize).toBe('10px');
    });

    it('renders identically to before when left unset', () => {
      render(
        <LastCornerPanel
          {...defaultProps}
          count={2}
          fontSize={10}
          entries={[
            entry({ sectionId: 'a', label: 'T5' }),
            entry({ sectionId: 'b', label: 'T4' }),
          ]}
        />
      );

      expect(rowOf('T5').style.fontSize).toBe('10px');
      expect(rowOf('T4').style.fontSize).toBe('10px');
    });

    it('reserves room for the enlarged hero before fitting the rest', () => {
      // Same stub pattern as 'drops the oldest lines...' above, but with a
      // latestScale big enough that only the hero fits.
      const fontSize = 10;
      const latestScale = 1.5;
      const rowHeight = Math.round(fontSize * 1.6) + 2;
      const heroHeight = Math.round(fontSize * latestScale * 1.6) + 2;
      class FakeResizeObserver {
        constructor(private cb: () => void) {}
        observe() {
          /* measurement is driven by the clientHeight stub below */
        }
        disconnect() {
          /* no teardown needed for the stub */
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      // Room for the hero plus a bit under one compact row — not enough for
      // a second full row.
      const clientHeight = vi
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockReturnValue(heroHeight + rowHeight - 1);

      try {
        render(
          <LastCornerPanel
            {...defaultProps}
            count={3}
            fontSize={fontSize}
            latestScale={latestScale}
            entries={[
              entry({ sectionId: 'a', label: 'T5' }),
              entry({ sectionId: 'b', label: 'T4' }),
              entry({ sectionId: 'c', label: 'T3' }),
            ]}
          />
        );

        expect(screen.getByText('T5')).toBeTruthy();
        expect(screen.queryByText('T4')).toBeNull();
        expect(screen.queryByText('T3')).toBeNull();
      } finally {
        clientHeight.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it('widens a side column to fit the enlarged hero', () => {
      const { rerender } = render(
        <LastCornerPanel {...defaultProps} placement="right" fontSize={10} />
      );
      const unscaled = parseFloat(panel().style.width);

      rerender(
        <LastCornerPanel
          {...defaultProps}
          placement="right"
          fontSize={10}
          latestScale={1.5}
        />
      );
      expect(parseFloat(panel().style.width)).toBeGreaterThan(unscaled);
    });
  });
});
