import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  simulatorHasDriverRatings,
  type ActiveSimulator,
} from '@irdashies/types';
import { BadgeCell } from './BadgeCell';

/**
 * Renders the cell as the widget does: the sim capability arrives as a prop,
 * resolved once per widget, so nothing here touches context.
 */
const cell = (
  props: Parameters<typeof BadgeCell>[0],
  simulator: ActiveSimulator | null = null
) =>
  render(
    <table>
      <tbody>
        <tr>
          <BadgeCell
            {...props}
            hasDriverRatings={simulatorHasDriverRatings(simulator)}
          />
        </tr>
      </tbody>
    </table>
  ).container.querySelector('[data-column="badge"]') as HTMLElement;

describe('BadgeCell under LMU', () => {
  it('draws nothing for a human whose rank has not arrived', () => {
    // The bug: the iRacing badge reads a missing licence and iRating as an AI
    // entry. Under LMU nobody has either, so every human was labelled "AI"
    // for the seconds before the rating service answered -- and for good, if
    // it never did.
    expect(cell({ lmuRating: undefined }, 'lmu').textContent).toBe('');
  });

  it('draws nothing for an AI entry either', () => {
    // An AI has no rank by design: the lookup excludes it and mapSession
    // declines to merge one, so the cell has nothing to say about it.
    expect(
      cell({ lmuRating: undefined, license: '', rating: 0 }, 'lmu').textContent
    ).toBe('');
  });

  it('draws the rank once it arrives', () => {
    // Drawn as sprite art rather than text, so the assertion is on the
    // element: an empty cell has no children at all.
    const shown = cell(
      { lmuRating: { driverRank: 'Gold', safetyRank: 'Silver' } },
      'lmu'
    );
    expect(shown.childElementCount).toBeGreaterThan(0);
    expect(shown.textContent).not.toContain('AI');
  });

  it('leaves the cell empty, not merely free of the word AI', () => {
    expect(cell({ lmuRating: undefined }, 'lmu').childElementCount).toBe(0);
  });

  it('never shows the iRacing placeholder, whatever the driver carries', () => {
    for (const props of [
      {},
      { license: 'A 4.00', rating: 3500 },
      { license: '', rating: 0 },
    ]) {
      expect(cell(props, 'lmu').textContent).not.toContain('AI');
    }
  });
});

describe('BadgeCell under iRacing', () => {
  it('still shows the AI placeholder, where it means something', () => {
    // iRacing's own AI entries carry no licence and no iRating, and calling
    // them out is the point of that badge.
    expect(cell({ license: '', rating: 0 }, 'iracing').textContent).toContain(
      'AI'
    );
  });

  it('still shows a licence and rating', () => {
    // Abbreviated by the badge itself; what matters here is that the iRacing
    // path still runs rather than exactly how it formats.
    expect(
      cell({ license: 'A 4.00', rating: 3500 }, 'iracing').textContent
    ).toContain('3.5k');
  });
});

describe('BadgeCell before a simulator is known', () => {
  it('keeps the iRacing behaviour, rather than guessing', () => {
    // simulatorHasDriverRatings defaults to true for the same reason
    // isWidgetDisabledForSim does: with no sim detected, hiding would be a
    // guess, and this is the path every existing iRacing install takes on the
    // first frames after launch.
    expect(cell({ license: '', rating: 0 }, null).textContent).toContain('AI');
  });
});

describe('BadgeCell default', () => {
  it('keeps the iRacing behaviour when the widget says nothing', () => {
    // Defaulting to true is what leaves every existing row spec, story and
    // caller behaving exactly as before this prop existed.
    const shown = render(
      <table>
        <tbody>
          <tr>
            <BadgeCell license="" rating={0} />
          </tr>
        </tbody>
      </table>
    ).container.querySelector('[data-column="badge"]') as HTMLElement;
    expect(shown.textContent).toContain('AI');
  });
});
