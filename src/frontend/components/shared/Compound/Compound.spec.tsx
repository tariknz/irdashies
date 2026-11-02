import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Compound } from './Compound';

const TIRES = [
  { TireIndex: 0, TireCompoundType: 'Hard' },
  { TireIndex: 1, TireCompoundType: 'Medium' },
  { TireIndex: 2, TireCompoundType: 'Soft' },
  { TireIndex: 3, TireCompoundType: 'Wet' },
];

/** The glyph is an svg; the split view is a grid of spans. */
const shape = (container: HTMLElement) => ({
  glyphs: container.querySelectorAll('svg').length,
  dots: container.querySelectorAll('span > span').length,
});

/** Every colour the rendered markup paints, in document order. */
const colors = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[stroke], [style*="background"]')].flatMap(
    (node) => {
      const stroke = node.getAttribute('stroke');
      const background = (node as HTMLElement).style?.background;
      return background ? [background] : stroke ? [stroke] : [];
    }
  );

describe('Compound', () => {
  it('draws one glyph when the sim reports a single compound', () => {
    const { container } = render(
      <Compound tireCompound={1} mockTires={TIRES} />
    );
    expect(shape(container)).toEqual({ glyphs: 1, dots: 0 });
  });

  it('draws one glyph when all four wheels agree', () => {
    const { container } = render(
      <Compound
        tireCompound={1}
        wheelCompounds={[1, 1, 1, 1]}
        mockTires={TIRES}
      />
    );
    expect(shape(container)).toEqual({ glyphs: 1, dots: 0 });
  });

  it('draws four dots when the wheels differ', () => {
    // A wet front and a dry rear is a real LMU choice, and the single glyph
    // could only have shown one of them.
    const { container } = render(
      <Compound
        tireCompound={3}
        wheelCompounds={[3, 3, 0, 0]}
        mockTires={TIRES}
      />
    );
    expect(shape(container)).toEqual({ glyphs: 0, dots: 4 });
  });

  it('colours each dot from its own wheel', () => {
    const { container } = render(
      <Compound
        tireCompound={3}
        wheelCompounds={[3, 3, 0, 0]}
        mockTires={TIRES}
      />
    );
    // Wet, wet, hard, hard.
    expect(colors(container)).toEqual([
      'rgb(7, 140, 209)',
      'rgb(7, 140, 209)',
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)',
    ]);
  });

  it('keeps the colour when a uniform set switches to the glyph', () => {
    // The two views must agree, or a car completing a pit stop appears to
    // change compound as the rendering changes.
    const split = render(
      <Compound
        tireCompound={0}
        wheelCompounds={[2, 2, 0, 0]}
        mockTires={TIRES}
      />
    );
    expect(colors(split.container)[0]).toBe('rgb(212, 0, 0)');

    const single = render(
      <Compound
        tireCompound={0}
        wheelCompounds={[2, 2, 2, 2]}
        mockTires={TIRES}
      />
    );
    // Soft, from the wheels, not Hard from the single-value channel.
    expect(colors(single.container)).toContain('#d40000');
  });

  it('renders nothing when there is no compound at all', () => {
    const { container } = render(
      <Compound tireCompound={-1} mockTires={TIRES} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('greys a wheel with no reading without hiding the others', () => {
    const { container } = render(
      <Compound
        tireCompound={3}
        wheelCompounds={[3, 3, -1, -1]}
        mockTires={TIRES}
      />
    );
    expect(shape(container)).toEqual({ glyphs: 0, dots: 4 });
    expect(colors(container).slice(2)).toEqual([
      'rgb(77, 77, 77)',
      'rgb(77, 77, 77)',
    ]);
  });

  it('matches a name no exact entry covers', () => {
    // LMU words its compounds freely where iRacing uses a closed set.
    const { container } = render(
      <Compound
        tireCompound={0}
        mockTires={[{ TireIndex: 0, TireCompoundType: 'Soft Slick' }]}
      />
    );
    expect(colors(container)).toContain('#d40000');
  });

  it('reads a wet before a hard in a name holding both', () => {
    // "Hard Wet" is a wet; matching "hard" first would paint it as a dry.
    const { container } = render(
      <Compound
        tireCompound={0}
        mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard Wet' }]}
      />
    );
    expect(colors(container)).toContain('#078cd1');
  });

  it('shows an unknown name as grey rather than as nothing', () => {
    const { container } = render(
      <Compound
        tireCompound={0}
        mockTires={[{ TireIndex: 0, TireCompoundType: 'Experimental' }]}
      />
    );
    expect(colors(container)).toContain('#888888');
  });

  it('keeps iRacing’s two-compound Hard-is-Dry labelling', () => {
    const { container } = render(
      <Compound
        tireCompound={0}
        mockTires={[
          { TireIndex: 0, TireCompoundType: 'Hard' },
          { TireIndex: 1, TireCompoundType: 'Wet' },
        ]}
      />
    );
    // Dry's grey, not Hard's white.
    expect(colors(container)).toContain('#4d4d4d');
  });

  it('ignores a wheel array that is not four long', () => {
    const { container } = render(
      <Compound tireCompound={1} wheelCompounds={[3, 3]} mockTires={TIRES} />
    );
    expect(shape(container)).toEqual({ glyphs: 1, dots: 0 });
  });
});
