import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DeltaSpeedBox } from './DeltaSpeedBox';

/** The filled element is the only one carrying an inline background colour. */
const boxOf = (container: HTMLElement) =>
  container.querySelector('[style*="background-color"]') as HTMLElement;

/**
 * Parses the alpha out of the background colour. The component writes the
 * space-separated `rgb(r g b / a)` form, but jsdom normalises it to
 * `rgba(r, g, b, a)`, so accept either. A fully opaque `rgb(r, g, b)` with no
 * alpha component means 1.
 */
const alphaOf = (el: HTMLElement): number => {
  const colour = el.style.backgroundColor;
  const slash = /rgba?\([^/]+\/\s*([0-9.]+)\s*\)/.exec(colour);
  if (slash) return parseFloat(slash[1]);

  const comma =
    /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([0-9.]+)\s*\)/.exec(
      colour
    );
  if (comma) return parseFloat(comma[1]);

  if (/^rgb\(/.test(colour)) return 1;
  throw new Error(`no alpha in "${colour}"`);
};

/**
 * Cap and threshold default to "off" here so the existing cases keep measuring
 * only what they were written to measure. Each has its own tests below.
 */
const renderBox = (props: Partial<Parameters<typeof DeltaSpeedBox>[0]> = {}) =>
  render(
    <DeltaSpeedBox
      deltaKph={0}
      scale={15}
      cap={0}
      updateThreshold={0}
      unit="km/h"
      showNumber
      {...props}
    />
  );

describe('DeltaSpeedBox', () => {
  it('is fully transparent at zero delta', () => {
    const { container } = renderBox({ deltaKph: 0 });
    expect(alphaOf(boxOf(container))).toBe(0);
  });

  it('scales opacity linearly with the delta', () => {
    const { container: quarter } = renderBox({ deltaKph: 3.75 });
    const { container: half } = renderBox({ deltaKph: 7.5 });

    expect(alphaOf(boxOf(quarter))).toBeCloseTo(0.25, 3);
    expect(alphaOf(boxOf(half))).toBeCloseTo(0.5, 3);
  });

  it('has no deadzone — a small delta still tints, however faintly', () => {
    // A consistent driver lives here. The tint is near-invisible by design,
    // but it must not be clamped to zero.
    const { container } = renderBox({ deltaKph: 0.4 });
    const alpha = alphaOf(boxOf(container));

    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.05);
  });

  it('clamps at full scale rather than exceeding it', () => {
    const { container: at } = renderBox({ deltaKph: 15 });
    const { container: beyond } = renderBox({ deltaKph: 60 });

    expect(alphaOf(boxOf(at))).toBe(1);
    expect(alphaOf(boxOf(beyond))).toBe(1);
  });

  it('uses the same magnitude of tint either side of zero', () => {
    const { container: faster } = renderBox({ deltaKph: 5 });
    const { container: slower } = renderBox({ deltaKph: -5 });

    expect(alphaOf(boxOf(faster))).toBeCloseTo(alphaOf(boxOf(slower)), 5);
    // ...but distinct colours.
    expect(boxOf(faster).style.backgroundColor).not.toBe(
      boxOf(slower).style.backgroundColor
    );
  });

  it('measures the delta against the cap for the displayed unit', () => {
    // 8.05 km/h is 5.0 mph — half of a 10 mph cap, not half of 15.
    const { container } = renderBox({
      deltaKph: 8.05,
      unit: 'mph',
      scale: 10,
    });

    expect(alphaOf(boxOf(container))).toBeCloseTo(0.5, 2);
    expect(screen.getByText('+5.0')).toBeInTheDocument();
  });

  it('keeps the number white and fully opaque at every delta', () => {
    // The number is the precision instrument; only the fill fades.
    for (const deltaKph of [0, 0.4, 7.5, 60]) {
      const { container } = renderBox({ deltaKph });
      const number = container.querySelector('.tabular-nums');

      expect(number).not.toBeNull();
      expect(number?.className).toContain('text-white');
      expect(number?.className).not.toMatch(/opacity-|text-(green|red)/);
    }
  });

  it('draws no outline of its own', () => {
    // Dropped deliberately. No other widget draws a white outline, and it was
    // the main reason this one read as foreign; the widget container's slate
    // panel already shows where it sits.
    const { container } = renderBox({ deltaKph: 0 });
    expect(boxOf(container).className).not.toContain('border');
  });

  it('caps the number while leaving the fill saturated', () => {
    const { container } = renderBox({ deltaKph: 42, scale: 15, cap: 9 });

    expect(container.querySelector('.tabular-nums')?.textContent).toContain(
      '+9.0'
    );
    // Past the cap the figure stops being useful, but the colour should still
    // say "a long way off".
    expect(alphaOf(boxOf(container))).toBe(1);
  });

  it('caps a negative delta, keeping the sign', () => {
    const { container } = renderBox({ deltaKph: -42, scale: 15, cap: 9 });
    expect(container.querySelector('.tabular-nums')?.textContent).toContain(
      '-9.0'
    );
  });

  it('holds the number until the delta moves past the update threshold', () => {
    const box = (deltaKph: number) => (
      <DeltaSpeedBox
        deltaKph={deltaKph}
        scale={15}
        cap={0}
        updateThreshold={0.2}
        unit="km/h"
        showNumber
      />
    );
    const { container, rerender } = render(box(1.1));
    const shown = () => container.querySelector('.tabular-nums')?.textContent;

    expect(shown()).toContain('+1.1');

    // The reported flicker: a 0.1 wobble should not move the readout.
    rerender(box(1.2));
    expect(shown()).toContain('+1.1');
    rerender(box(1.1));
    expect(shown()).toContain('+1.1');

    // A real change still gets through.
    rerender(box(1.4));
    expect(shown()).toContain('+1.4');
  });

  it('follows the same padding ladder as the information bar', () => {
    // Matching SessionBar's standalone padding, so the two widgets stay
    // visually consistent at every compact setting rather than only the default.
    const cases: [string, string[]][] = [
      ['normal', ['px-4', 'py-2']],
      ['compact', ['px-3', 'py-1']],
      ['ultra', ['px-2', 'py-0']],
    ];

    for (const [density, expected] of cases) {
      const { container } = renderBox({
        density: density as 'normal' | 'compact' | 'ultra',
      });
      for (const cls of expected) {
        expect(boxOf(container).className).toContain(cls);
      }
    }
  });

  it('sits one step above the information bar text size', () => {
    const { container } = renderBox({ deltaKph: 4.2 });
    expect(boxOf(container).className).toContain('text-base');
  });

  it('transitions the fill only, never the number', () => {
    // An eased number would lag the true value; an eased fill just smooths.
    const { container } = renderBox({ deltaKph: 5 });
    expect(boxOf(container).className).toContain('transition-colors');
  });
});
